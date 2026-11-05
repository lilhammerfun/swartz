import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CHAT_STORAGE_KEY,
  emptyChat,
  retryQuestion,
  type ChatSession,
} from "./chat-store.ts";
import {
  prepareQuestionRequest,
  type ConversationRequest,
} from "./conversation-request.ts";

const samples = JSON.parse(
  readFileSync(
    new URL(
      "../../../src-tauri/mock-data/conversation-contracts.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { requests: Record<string, ConversationRequest> };

function storedQuestion(request: ConversationRequest): ChatSession {
  assert.equal(request.input.kind, "question");
  if (request.input.kind !== "question") throw new Error("Expected a question");
  return {
    id:
      request.target.kind === "unassigned"
        ? request.target.conversationId
        : "chat-legacy-rust",
    ...(request.target.kind === "project"
      ? { bookId: request.target.projectId }
      : {}),
    title: "Saved learning conversation",
    createdAt: "2026-11-03T12:00:00Z",
    updatedAt: "2026-11-04T02:00:00Z",
    draft: "A draft stays in the UI",
    draftAttachments: [],
    messages: structuredClone([...request.history, request.input.message]),
    request: {
      id: request.requestId,
      userMessageId: request.input.message.id,
      status: "error",
      error: "Previous attempt failed",
      options: { ...request.options },
    },
  };
}

test("ordinary and quoted questions match the Rust wire contract without repeating the current message", () => {
  for (const name of ["ordinary", "quoted"]) {
    const expected = samples.requests[name];
    const source = storedQuestion(expected);
    const request = prepareQuestionRequest(source);
    assert.deepEqual(request, expected);
    assert.equal(request.history.length, source.messages.length - 1);
    // Later UI changes must not mutate prepared history, attachments, or the original quoted text.
    for (const message of source.messages) message.text = "Later UI state";
    const passage = source.messages.at(-1)?.passage;
    if (passage) passage.quote = "Later textbook wording";
    assert.deepEqual(request, expected);
    assert.equal("draft" in request, false);
    assert.equal("systemPrompt" in request, false);
  }
});

test("retrying retains project and question identity while replacing only the attempt", () => {
  const session = storedQuestion(samples.requests.quoted);
  const snapshot = { ...emptyChat(), sessions: [session] };
  const data = new Map([[CHAT_STORAGE_KEY, JSON.stringify(snapshot)]]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const before = prepareQuestionRequest(session);
  const retried = retryQuestion(storage, session.id).sessions[0];
  const after = prepareQuestionRequest(retried);
  assert.notEqual(after.requestId, before.requestId);
  assert.deepEqual(after.target, before.target);
  assert.deepEqual(after.input, before.input);
  assert.deepEqual(after.history, before.history);
});

test("a stale pending-message link cannot silently submit a different question", () => {
  const session = storedQuestion(samples.requests.quoted);
  session.request!.userMessageId = "another-question";
  assert.throws(() => prepareQuestionRequest(session), /pending question/);
});
