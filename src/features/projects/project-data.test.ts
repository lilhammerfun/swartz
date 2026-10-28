import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  projectBook,
  orderRecentProjects,
  recentActivities,
  type ProjectDetail,
} from "./project-data.ts";

const details = JSON.parse(
  readFileSync(
    new URL("../../mock-data/projects.json", import.meta.url),
    "utf8",
  ),
) as ProjectDetail[];

test("workspace identity stays with the project while textbook identity remains in the detail", () => {
  const detail = details[0];
  const before = JSON.stringify(detail);
  const book = projectBook(detail.project, detail);
  assert.equal(book.id, detail.project.id);
  assert.notEqual(book.id, detail.textbook!.id);
  assert.equal(book.version, detail.textbook!.version);
  assert.deepEqual(book.chapters, detail.textbook!.chapters);
  assert.equal(JSON.stringify(detail), before);
});

test("a project without a textbook can open a stable workspace without fabricated chapters", () => {
  const detail = details.find((item) => item.textbook === null)!;
  const fromList = projectBook(detail.project);
  const fromDetail = projectBook(detail.project, detail);
  assert.equal(fromList.id, fromDetail.id);
  assert.deepEqual(fromDetail.chapters, []);
  assert.equal(fromDetail.title, detail.project.title);
});

test("the activity feed displays newest facts first without changing the stored source order", () => {
  const activities = details[0].activities;
  const before = structuredClone(activities);
  const sorted = recentActivities(activities);
  assert.equal(sorted[0].kind, "textbook_revised");
  assert.equal(sorted.at(-1)!.kind, "goal_updated");
  assert.deepEqual(activities, before);
});

test("Recent keeps assigned and unvisited projects while ordering by latest use", () => {
  const projects = details.map((item) => ({ ...item.project }));
  projects[1].librarySectionId = "systems";
  const before = structuredClone(projects);
  const ordered = orderRecentProjects(projects, [
    { bookId: projects[1].id, updatedAt: "2026-10-28T08:00:00Z" },
    { bookId: projects[2].id, updatedAt: "2026-10-27T08:00:00Z" },
    { bookId: projects[1].id, updatedAt: "2026-10-26T08:00:00Z" },
  ]);
  assert.deepEqual(
    ordered.map((item) => item.id),
    [
      projects[1].id,
      projects[2].id,
      projects[0].id,
      ...projects.slice(3).map((item) => item.id),
    ],
  );
  assert.deepEqual(projects, before);
});
