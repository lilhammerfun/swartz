import assert from "node:assert/strict";
import { test } from "node:test";
import type { Annotation } from "../../types/book.ts";
import { readingAnnotations } from "./reading-annotations.ts";

const note: Annotation = {
  id: "note-1",
  anchor: {
    bookId: "book",
    chapterId: "chapter",
    sectionId: "section",
    paragraphId: "paragraph",
    version: 1,
    quote: "The original text.",
  },
  text: "My understanding.",
  createdAt: "2026-10-22T08:00:00.000Z",
};

test("crowded annotations follow source order and isolate books without mutating saved order", () => {
  const later = {
    ...structuredClone(note),
    id: "later",
    anchor: { ...note.anchor, paragraphId: "second" },
  };
  const first = { ...structuredClone(note), id: "first" };
  const followup = {
    ...structuredClone(first),
    id: "followup",
    createdAt: "2026-10-22T09:00:00.000Z",
  };
  const otherBook = {
    ...structuredClone(first),
    id: "other",
    anchor: { ...first.anchor, bookId: "other-book" },
  };
  const original = [later, followup, otherBook, first];
  const result = readingAnnotations(original, "book", {
    id: "section",
    title: "Section",
    subtitle: "",
    paragraphs: [
      { id: "paragraph", text: "First" },
      { id: "second", text: "Second" },
    ],
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["first", "followup", "later"],
  );
  assert.deepEqual(
    original.map((item) => item.id),
    ["later", "followup", "other", "first"],
  );
});
