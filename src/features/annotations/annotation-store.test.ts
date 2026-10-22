import assert from "node:assert/strict";
import { test } from "node:test";
import type { Annotation } from "../../types/book.ts";
import { readingAnnotations } from "./reading-annotations.ts";
import {
  appendAnnotation,
  parseAnnotations,
  migrateAnnotations,
  saveAnnotationSnapshot,
  STORAGE_KEY,
} from "./annotation-store.ts";

const note: Annotation = {
  id: "note-1",
  kind: "note",
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
  messages: [],
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

test("annotations keep an independent snapshot of the original quote", () => {
  const input = structuredClone(note);
  const next = appendAnnotation([], input);
  input.anchor.quote = "A later revision.";
  assert.equal(next[0].anchor.quote, "The original text.");
  assert.equal(next[0].anchor.version, 1);
});

test("repeating the same annotation does not duplicate it or mutate the list", () => {
  const original = [structuredClone(note)];
  const result = appendAnnotation(original, { ...note, text: "A duplicate." });
  assert.equal(result.length, 1);
  assert.equal(result[0].text, "My understanding.");
  assert.notEqual(result, original);
});

test("saved notes and discussions survive a round trip", () => {
  const question: Annotation = {
    ...note,
    kind: "question",
    messages: [{ id: "reply", role: "assistant", text: "An explanation." }],
  };
  assert.deepEqual(parseAnnotations(JSON.stringify([question])), [question]);
});

test("malformed persisted data and duplicate identities are rejected", () => {
  for (const data of [
    null,
    {},
    [{}],
    [note, note],
    [{ ...note, anchor: { ...note.anchor, version: 0 } }],
    [{ ...note, messages: [{ id: "x", role: "system", text: "invalid" }] }],
  ]) {
    assert.throws(() => parseAnnotations(JSON.stringify(data)));
  }
});

test("saving after a corrupt snapshot preserves the exact original bytes", () => {
  const corrupted = '{"unreadable":';
  const values = new Map([[STORAGE_KEY, corrupted]]);
  saveAnnotationSnapshot(
    {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    },
    [note],
  );
  assert.deepEqual(parseAnnotations(values.get(STORAGE_KEY)!), [note]);
  assert.equal(
    [...values].find(([key]) =>
      key.startsWith(`${STORAGE_KEY}.recovery.`),
    )?.[1],
    corrupted,
  );
});

test("backup failure cannot overwrite the unreadable original", () => {
  let overwritten = false;
  assert.throws(() =>
    saveAnnotationSnapshot(
      {
        getItem: () => "corrupt",
        setItem: (key) => {
          if (key === STORAGE_KEY) overwritten = true;
          throw new Error("Quota exceeded");
        },
      },
      [note],
    ),
  );
  assert.equal(overwritten, false);
});

test("legacy built-in notes are removed without modifying their stored objects", () => {
  const legacy = { ...structuredClone(note), id: "note-exclusive" };
  const migrated = migrateAnnotations([legacy, note]);
  assert.deepEqual(migrated, [note]);
  assert.equal(legacy.text, "My understanding.");
});

test("migration retains user writing but never carries generated placeholder replies forward", () => {
  const legacy: Annotation = {
    ...structuredClone(note),
    id: "question-two",
    messages: [
      { id: "reply-demo", role: "assistant", text: "A built-in explanation." },
      { id: "actual-user", role: "user", text: "My own follow-up." },
      {
        id: "placeholder",
        role: "assistant",
        text: "这条回复用于演示原文旁的讨论布局，尚未连接 AI。",
      },
      { id: "actual-user-2", role: "user", text: "One more observation." },
    ],
  };
  const [migrated] = migrateAnnotations([legacy]);
  assert.equal(migrated.text, "My own follow-up.");
  assert.deepEqual(migrated.messages, [
    { id: "actual-user-2", role: "user", text: "One more observation." },
  ]);
  assert.deepEqual(migrated.anchor, legacy.anchor);
  assert.equal(legacy.messages.length, 4);
});
