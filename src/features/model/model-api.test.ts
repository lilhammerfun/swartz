import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  normalizeBaseUrl,
  prepareModelConfig,
  requestModel,
} from "./model-api.ts";
import { learningMessages } from "./learning-messages.ts";
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

test("changing endpoints cannot silently reuse the previous provider key", () => {
  const previous = {
    baseUrl: "https://first.example/v1",
    model: "model-a",
    apiKey: "test-only-key",
  };
  assert.throws(
    () =>
      prepareModelConfig(
        { baseUrl: "https://other.example/v1", model: "model-b", apiKey: "" },
        previous,
      ),
    /API key/,
  );
  assert.equal(
    prepareModelConfig({ ...previous, model: "model-b", apiKey: "" }, previous)
      .apiKey,
    "test-only-key",
  );
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

test("follow-ups include the original quote, chapter purpose, and complete prior exchange", () => {
  const discussion = answeredAnnotation(
    anchor,
    "Why exclusive access?",
    "A writer can invalidate a reader's assumptions.",
  );
  const messages = learningMessages(
    learningBook,
    anchor,
    "Can you show an example?",
    discussion,
  );
  const context = JSON.parse(messages[1].content);
  assert.equal(context.selectedPassage, anchor.quote);
  assert.equal(context.question, discussion.text);
  assert.ok(context.chapterPurpose);
  assert.deepEqual(
    messages.slice(2).map((m) => m.role),
    ["assistant", "user"],
  );
  assert.equal(messages.at(-1)?.content, "Can you show an example?");
});

test("the real HTTP client sends the configured model and context and parses a protocol fixture", async () => {
  let payload: unknown;
  const server = createServer(async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/v1/chat/completions");
    assert.equal(req.headers.authorization, "Bearer test-only-key");
    let body = "";
    for await (const chunk of req) body += chunk;
    payload = JSON.parse(body);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [{ message: { content: "A local protocol fixture answer." } }],
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const messages = learningMessages(
      learningBook,
      anchor,
      "Why exclusive access?",
    );
    const answer = await requestModel(
      {
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "test-model",
        apiKey: "test-only-key",
      },
      messages,
    );
    assert.equal(answer, "A local protocol fixture answer.");
    assert.deepEqual(payload, { model: "test-model", messages, stream: false });
    await requestModel(
      {
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "test-model",
        apiKey: "test-only-key",
      },
      messages,
      { model: "selected-model", reasoningEffort: "low" },
    );
    assert.deepEqual(payload, {
      model: "selected-model",
      messages,
      stream: false,
      reasoning_effort: "low",
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("text attachments survive saving and are included in subsequent questions", async () => {
  const files = await readPromptAttachments(
    [new File(["A reader borrows without moving ownership."], "notes.md")],
    [],
  );
  const first = learningMessages(
    learningBook,
    anchor,
    "Compare this note.",
    undefined,
    files,
  );
  assert.deepEqual(JSON.parse(first[1].content).attachments, files);
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
  const next = learningMessages(learningBook, anchor, "Why?", restored);
  assert.deepEqual(JSON.parse(next[1].content).attachments, files);
  assert.deepEqual(JSON.parse(next[3].content).attachments, followupFiles);
  assert.equal(next.at(-1)?.content, "Why?");
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

test("provider failures and empty output preserve the question and do not leak response bodies", async () => {
  let status = 401;
  const server = createServer((_req, res) => {
    res.statusCode = status;
    res.end(
      status === 200
        ? JSON.stringify({ choices: [{ message: { content: "" } }] })
        : "provider echoed test-only-secret",
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const config = {
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      model: "test-model",
      apiKey: "",
    };
    const messages = learningMessages(learningBook, anchor, "Why?");
    await assert.rejects(
      requestModel(config, messages),
      (error) =>
        error instanceof Error &&
        error.message.includes("API key") &&
        !error.message.includes("test-only-secret"),
    );
    status = 200;
    await assert.rejects(requestModel(config, messages), /returned no text/);
    assert.equal(JSON.parse(messages[1].content).question, "Why?");
  } finally {
    server.close();
    await once(server, "close");
  }
});
