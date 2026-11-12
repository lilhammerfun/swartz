import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { loadWorkspaceBook } from "./workspace-loader.ts";
import type { ProjectDetail } from "../features/projects/project-data.ts";
import {
  getLibrary,
  listProjects,
  getProjectDetail,
  updateLibrary,
} from "../features/projects/project-service.ts";

const {
  projects: [detail],
} = JSON.parse(
  readFileSync(
    new URL(
      "../../src-tauri/mock-data/backend-interview.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { projects: ProjectDetail[] };

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

test("browser previews stay empty and cannot write a simulated project library", async () => {
  setup();
  Object.assign(globalThis, { isTauri: false });
  try {
    // No localStorage is installed: old preview data must never become project data.
    mockIPC(() => assert.fail("A browser preview has no Rust connection."));
    assert.deepEqual(await getLibrary(), { sections: [], projects: [] });
    assert.deepEqual(await listProjects(), []);
    await assert.rejects(getProjectDetail(detail.project.id), /desktop app/);
    await assert.rejects(
      updateLibrary({ kind: "create_section", id: "systems", name: "Systems" }),
      /desktop app/,
    );
  } finally {
    cleanup();
  }
});

test("project organization is persisted through the Rust command", async () => {
  setup();
  try {
    const change = {
      kind: "create_section" as const,
      id: "systems",
      name: "Systems",
    };
    const saved = {
      sections: [{ id: "systems", name: "Systems" }],
      projects: [],
    };
    mockIPC((command, args) => {
      assert.equal(command, "update_library");
      assert.deepEqual(args, { change });
      return saved;
    });
    assert.deepEqual(await updateLibrary(change), saved);
  } finally {
    cleanup();
  }
});

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
