import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeBaseUrl, modelIsConfigured } from "./model-api.ts";
import {
  answeredAnnotation,
  appendAnsweredExchange,
} from "../annotations/answered-discussion.ts";
import { learningBook } from "../../mock-data/book.ts";
import type { AnnotationAnchor } from "../../types/book.ts";
import { readPromptAttachments } from "../annotations/prompt-attachments.ts";
import { promptChoices } from "../annotations/prompt-options.ts";
import { parseAnnotations } from "../annotations/annotation-store.ts";

const anchor: AnnotationAnchor = {
  bookId: learningBook.id,
  chapterId: "borrowing",
  sectionId: "mutable",
  paragraphId: "mutable-intro",
  version: 1,
  quote: "A mutable reference gives you exclusive access.",
};

test("model settings distinguish local endpoints and reject unsafe URLs", () => {
  for (const invalid of [
    "http://remote.example/v1",
    "https://user:key@example.com/v1",
    "https://example.com/v1?api_key=key",
  ])
    assert.throws(() => normalizeBaseUrl(invalid));
  assert.equal(
    normalizeBaseUrl("http://localhost:1234/v1/"),
    "http://localhost:1234/v1",
  );
  assert.equal(
    modelIsConfigured({
      baseUrl: "http://localhost:1234/v1",
      model: "local-model",
      hasApiKey: false,
    }),
    true,
  );
  assert.equal(
    modelIsConfigured({
      baseUrl: "https://provider.example/v1",
      model: "remote-model",
      hasApiKey: false,
    }),
    false,
  );
});

test("an unanswered question cannot become an annotation", () => {
  assert.throws(() => answeredAnnotation(anchor, "Why?", ""), /AI answer/);
  const original = structuredClone(anchor);
  const annotation = answeredAnnotation(
    original,
    "Why?",
    "Because access is exclusive.",
  );
  original.quote = "Changed text";
  assert.equal(annotation.anchor.quote, anchor.quote);
  assert.equal(annotation.kind, "question");
  assert.equal(annotation.messages[0].role, "assistant");
  const updated = appendAnsweredExchange(
    [annotation],
    annotation.id,
    "What about two readers?",
    "Shared access permits multiple readers.",
  );
  assert.deepEqual(
    updated[0].messages.map((m) => m.role),
    ["assistant", "user", "assistant"],
  );
  assert.equal(annotation.messages.length, 1);
});

test("text attachments survive saving with their original question and follow-up", async () => {
  const files = await readPromptAttachments(
    [new File(["A reader borrows without moving ownership."], "notes.md")],
    [],
  );
  const discussion = answeredAnnotation(
    anchor,
    "Compare this note.",
    "Both describe shared access.",
    files,
  );
  const followupFiles = await readPromptAttachments(
    [new File(["let r = &value;"], "example.txt")],
    [],
  );
  const updated = appendAnsweredExchange(
    [discussion],
    discussion.id,
    "Explain this example.",
    "The reference borrows value.",
    followupFiles,
  );
  const restored = parseAnnotations(JSON.stringify(updated))[0];
  assert.deepEqual(restored.attachments, files);
  assert.deepEqual(restored.messages[1].attachments, followupFiles);
  assert.equal(restored.messages[1].text, "Explain this example.");
  assert.equal(restored.text, "Compare this note.");
});

test("attachments reject unsupported, binary, oversized, and excessive files before submission", async () => {
  await assert.rejects(
    readPromptAttachments([new File(["PDF"], "notes.pdf")], []),
    /text/,
  );
  await assert.rejects(
    readPromptAttachments(
      [new File([new Uint8Array([255])], "invalid.txt")],
      [],
    ),
    /UTF-8/,
  );
  await assert.rejects(
    readPromptAttachments([new File(["\u0000"], "binary.txt")], []),
    /readable/,
  );
  await assert.rejects(
    readPromptAttachments([new File(["a".repeat(80001)], "large.txt")], []),
    /large/,
  );
  await assert.rejects(
    readPromptAttachments(
      Array.from({ length: 5 }, () => new File(["text"], "notes.md")),
      [],
    ),
    /4/,
  );
  const invalid = {
    ...answeredAnnotation(anchor, "Why?", "An answer."),
    attachments: [{ id: "one", name: "bad.txt", text: 42 }],
  };
  assert.throws(
    () => parseAnnotations(JSON.stringify([invalid])),
    /Invalid annotation/,
  );
});

test("prompt options use real provider capabilities without suggesting unrelated models", () => {
  const settings = {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    hasApiKey: true,
  };
  const deepseek = promptChoices(settings);
  assert.deepEqual(
    deepseek.models.map((m) => m.id),
    ["deepseek-flash", "deepseek-v4-pro"],
  );
  assert.deepEqual(
    deepseek.efforts.map((e) => e.id),
    ["none", "low", "high", "max"],
  );
  const custom = promptChoices({
    ...settings,
    baseUrl: "https://api.deepseek.com.example/v1",
    model: "my-model",
  });
  assert.deepEqual(
    custom.models.map((m) => m.id),
    ["my-model"],
  );
  assert.equal(custom.defaultEffort, "default");
});
