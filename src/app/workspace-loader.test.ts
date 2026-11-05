import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { loadWorkspaceBook } from "./workspace-loader.ts";
import type { ProjectDetail } from "../features/projects/project-data.ts";

const [detail] = JSON.parse(
  readFileSync(new URL("../mock-data/projects.json", import.meta.url), "utf8"),
) as ProjectDetail[];

function setup() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  Object.assign(globalThis, { isTauri: true });
}

function cleanup() {
  clearMocks();
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "isTauri");
}

test("a workspace reads its project and textbook through Rust commands", async () => {
  setup();
  try {
    const calls: string[] = [];
    mockIPC((command, args) => {
      calls.push(command);
      if (command === "get_library")
        return { sections: [], projects: [detail.project] };
      assert.equal(command, "get_project_detail");
      assert.deepEqual(args, { projectId: detail.project.id });
      return detail;
    });
    const { book } = await loadWorkspaceBook(detail.project.id);
    assert.equal(book.id, detail.project.id);
    assert.deepEqual(book.chapters, detail.textbook!.chapters);
    assert.deepEqual(calls, ["get_library", "get_project_detail"]);
  } finally {
    cleanup();
  }
});

test("a missing project returns 404 without consulting a standalone book store", async () => {
  setup();
  try {
    mockIPC((command) => {
      assert.equal(command, "get_library");
      return { sections: [], projects: [] };
    });
    // No localStorage is installed: the route must not try a second catalog.
    await assert.rejects(
      loadWorkspaceBook("book-standalone"),
      (error: unknown) => error instanceof Response && error.status === 404,
    );
  } finally {
    cleanup();
  }
});

test("a failed project read is propagated rather than replaced by a sample book", async () => {
  setup();
  try {
    mockIPC((command) => {
      if (command === "get_library")
        return { sections: [], projects: [detail.project] };
      assert.equal(command, "get_project_detail");
      throw new Error("Project storage is unavailable.");
    });
    await assert.rejects(
      loadWorkspaceBook(detail.project.id),
      /storage is unavailable/,
    );
  } finally {
    cleanup();
  }
});
