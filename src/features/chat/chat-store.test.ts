import assert from "node:assert/strict";
import test from "node:test";
import type { LearningBook } from "../../types/book.ts";
import { ordinaryChatMessages } from "./chat-messages.ts";
import {
  CHAT_STORAGE_KEY,
  queueQuestion,
  readChat,
  recoverChat,
  restoreFailedRequests,
  retryQuestion,
  settleQuestion,
  startBookSession,
  updateChat,
} from "./chat-store.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
const question = {
  text: "Why is borrowing useful?",
  attachments: [
    {
      id: "file-1",
      name: "notes.md",
      text: "# Ownership\nOne owner per value.",
    },
  ],
  options: { model: "local-model", reasoningEffort: "low" as const },
};

test("question is durable before a response, and reload marks it interrupted without duplicating it on retry", () => {
  const storage = memoryStorage();
  updateChat(storage, (snapshot) => {
    snapshot.homeDraft = question.text;
    snapshot.homeAttachments = question.attachments;
  });
  const queued = queueQuestion(storage, question);
  assert.equal(readChat(storage).sessions[0].messages[0].text, question.text);
  assert.equal(readChat(storage).sessions[0].request?.status, "pending");
  assert.equal(readChat(storage).homeDraft, "");
  assert.deepEqual(readChat(storage).homeAttachments, []);
  const restored = recoverChat(storage).sessions[0];
  assert.equal(restored.request?.status, "interrupted");
  assert.deepEqual(restored.messages[0].attachments, question.attachments);
  const retried = retryQuestion(storage, restored.id).sessions[0];
  assert.equal(retried.messages.length, 1);
  assert.deepEqual(retried.request?.options, question.options);
  settleQuestion(storage, restored.id, queued.session.request!.userMessageId, {
    answer: "Borrowing shares access without moving ownership.",
  });
  const finished = readChat(storage).sessions[0];
  assert.deepEqual(
    finished.messages.map((message) => message.role),
    ["user", "assistant"],
  );
  assert.equal(finished.request, undefined);
});

test("failed requests retain their original question and options; follow-up uses the same conversation", () => {
  const storage = memoryStorage();
  const { session } = queueQuestion(storage, question);
  settleQuestion(storage, session.id, session.request!.userMessageId, {
    error: "Provider unavailable",
  });
  assert.throws(() =>
    queueQuestion(storage, { ...question, sessionId: session.id }),
  );
  const retried = retryQuestion(storage, session.id).sessions[0];
  settleQuestion(storage, session.id, retried.request!.userMessageId, {
    answer: "First answer",
  });
  const next = queueQuestion(storage, {
    ...question,
    sessionId: session.id,
    text: "Show an example",
    attachments: [],
  });
  assert.equal(next.snapshot.sessions.length, 1);
  assert.deepEqual(
    next.session.messages.map((message) => message.text),
    [question.text, "First answer", "Show an example"],
  );
  assert.throws(() =>
    settleQuestion(storage, session.id, session.request!.userMessageId, {
      answer: "Late stale answer",
    }),
  );
  assert.equal(readChat(storage).sessions[0].messages.length, 3);
});

test("malformed snapshots are preserved, and failed writes preserve drafts without reporting a queued question", () => {
  const storage = memoryStorage();
  storage.setItem(CHAT_STORAGE_KEY, '{"broken":true}');
  assert.throws(() => queueQuestion(storage, question));
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), '{"broken":true}');
  const healthy = memoryStorage();
  updateChat(healthy, (snapshot) => {
    snapshot.homeDraft = "My unsent question";
  });
  const before = healthy.getItem(CHAT_STORAGE_KEY);
  const failing = {
    getItem: healthy.getItem,
    setItem: () => {
      throw new Error("Quota exceeded");
    },
  };
  assert.throws(() => queueQuestion(failing, question));
  assert.equal(healthy.getItem(CHAT_STORAGE_KEY), before);
  const { session } = queueQuestion(healthy, question);
  const queued = healthy.getItem(CHAT_STORAGE_KEY);
  assert.throws(() =>
    settleQuestion(failing, session.id, session.request!.userMessageId, {
      answer: "Unsaved answer",
    }),
  );
  assert.equal(healthy.getItem(CHAT_STORAGE_KEY), queued);
});

test("draft updates read the latest storage so they retain another session, and attachments restore", () => {
  const storage = memoryStorage();
  const first = queueQuestion(storage, question).session;
  const second = queueQuestion(storage, {
    ...question,
    text: "Second question",
  }).session;
  updateChat(storage, (snapshot) => {
    const session = snapshot.sessions.find((item) => item.id === first.id)!;
    session.draft = "A follow-up";
    session.draftAttachments = question.attachments;
  });
  const restored = readChat(storage);
  assert.equal(restored.sessions.length, 2);
  assert.equal(restored.sessions[0].id, second.id);
  assert.equal(restored.sessions[1].draft, "A follow-up");
  assert.deepEqual(restored.sessions[1].draftAttachments, question.attachments);
});

test("ordinary chat sends history and real attachment contents with no invented passage or book mutations", () => {
  const storage = memoryStorage();
  const { session } = queueQuestion(storage, question);
  settleQuestion(storage, session.id, session.request!.userMessageId, {
    answer: "Answer one",
  });
  const continued = queueQuestion(storage, {
    ...question,
    sessionId: session.id,
    text: "And references?",
    attachments: [],
  }).session;
  const messages = ordinaryChatMessages(continued);
  assert.deepEqual(
    messages.map((message) => message.role),
    ["system", "user", "assistant", "user"],
  );
  assert.equal(
    JSON.parse(messages[1].content).attachments[0].text,
    question.attachments[0].text,
  );
  assert.equal(messages[2].content, "Answer one");
  assert.equal(messages[3].content, "And references?");
  assert.match(messages[0].content, /cannot create or modify books/);
  assert.doesNotMatch(messages[1].content, /selectedPassage/);
});

test("book conversations include hierarchy as context and enforce request length before sending", () => {
  const storage = memoryStorage();
  const book: LearningBook = {
    id: "book-a",
    title: "Borrowing",
    subtitle: "Rust",
    version: 1,
    chapters: [
      {
        id: "c",
        title: "Ownership",
        purpose: "Understand access",
        sections: [
          {
            id: "s",
            title: "References",
            subtitle: "",
            paragraphs: [{ id: "p", text: "A reference borrows access." }],
          },
        ],
      },
    ],
  };
  const { session } = queueQuestion(storage, { ...question, bookId: book.id });
  assert.throws(() => ordinaryChatMessages(session));
  const messages = ordinaryChatMessages(session, book);
  const context = JSON.parse(messages[1].content).bookContext;
  assert.equal(context.chapters[0].purpose, "Understand access");
  assert.equal(
    context.chapters[0].sections[0].text,
    "A reference borrows access.",
  );
  assert.equal(
    book.chapters[0].sections[0].paragraphs[0].text,
    "A reference borrows access.",
  );
  assert.throws(() =>
    ordinaryChatMessages(
      {
        ...session,
        messages: [{ ...session.messages[0], text: "a".repeat(120000) }],
      },
      book,
    ),
  );
  assert.throws(() =>
    queueQuestion(storage, {
      ...question,
      attachments: [{ id: "bad", name: "bad.md", text: "a".repeat(20001) }],
    }),
  );
});

test("book conversations can be opened empty without inventing messages or clearing Home drafts", () => {
  const storage = memoryStorage();
  updateChat(storage, (snapshot) => {
    snapshot.homeDraft = "An unsent idea";
  });
  const first = startBookSession(storage, {
    id: "book-rust",
    title: "Learning Rust",
  });
  assert.deepEqual(first.session.messages, []);
  assert.equal(first.snapshot.homeDraft, "An unsent idea");
  assert.equal(
    startBookSession(storage, { id: "book-rust", title: "Learning Rust" })
      .session.id,
    first.session.id,
  );
  assert.equal(readChat(storage).sessions.length, 1);
  queueQuestion(storage, { ...question, sessionId: first.session.id });
  assert.equal(readChat(storage).sessions[0].messages.length, 1);
});

test("a locally failed answer write can retry only its owned pending attempt, and old results cannot settle the new attempt", () => {
  const storage = memoryStorage();
  const { session } = queueQuestion(storage, question);
  const original = session.request!;
  const failing = {
    getItem: storage.getItem,
    setItem: () => {
      throw new Error("Quota exceeded");
    },
  };
  assert.throws(() =>
    settleQuestion(
      failing,
      session.id,
      original.userMessageId,
      { answer: "Lost answer" },
      original.id,
    ),
  );
  assert.throws(() => retryQuestion(storage, session.id));
  assert.throws(() => retryQuestion(storage, session.id, "another-request"));
  const retried = retryQuestion(storage, session.id, original.id).sessions[0];
  assert.notEqual(retried.request!.id, original.id);
  assert.equal(retried.messages.length, 1);
  assert.throws(() =>
    settleQuestion(
      storage,
      session.id,
      original.userMessageId,
      { answer: "Stale answer" },
      original.id,
    ),
  );
  settleQuestion(
    storage,
    session.id,
    original.userMessageId,
    { answer: "Retried answer" },
    retried.request!.id,
  );
  assert.equal(
    readChat(storage).sessions[0].messages[1].text,
    "Retried answer",
  );
});

test("draft saves and storage-event snapshots recover only this tab's failed pending request, keeping Retry available", () => {
  const storage = memoryStorage();
  const first = queueQuestion(storage, question).session;
  const second = queueQuestion(storage, {
    ...question,
    text: "A live request in another tab",
  }).session;
  const failures = new Map([
    [
      first.id,
      { requestId: first.request!.id, error: "Could not save the answer" },
    ],
  ]);
  // A storage event after the failed write reads pending from disk; only our owned failure becomes retryable.
  const incoming = readChat(storage);
  restoreFailedRequests(incoming, failures);
  assert.equal(
    incoming.sessions.find((session) => session.id === first.id)!.request!
      .status,
    "error",
  );
  assert.equal(
    incoming.sessions.find((session) => session.id === second.id)!.request!
      .status,
    "pending",
  );
  // When storage is available again, typing a draft must not resurrect the orphaned pending state.
  const saved = updateChat(storage, (snapshot) => {
    restoreFailedRequests(snapshot, failures);
    const session = snapshot.sessions.find((item) => item.id === first.id)!;
    session.draft = "A draft after storage recovered";
    session.draftAttachments = question.attachments;
  });
  assert.equal(
    saved.sessions.find((session) => session.id === first.id)!.draft,
    "A draft after storage recovered",
  );
  assert.equal(
    saved.sessions.find((session) => session.id === first.id)!.request!.status,
    "error",
  );
  const next = retryQuestion(storage, first.id);
  const retried = next.sessions.find((session) => session.id === first.id)!;
  // Stale ownership cannot overwrite a newly retried attempt, including storage events while it is active.
  restoreFailedRequests(next, failures, retried.request!.id);
  assert.equal(retried.request!.status, "pending");
  assert.notEqual(retried.request!.id, first.request!.id);
  assert.equal(retried.messages.length, 1);
  assert.equal(
    next.sessions.find((session) => session.id === second.id)!.request!.status,
    "pending",
  );
});

test("retry can repair the selected model and effort without duplicating the user question, preserving original options by default", () => {
  const storage = memoryStorage();
  const { session } = queueQuestion(storage, question);
  const original = session.request!;
  settleQuestion(
    storage,
    session.id,
    original.userMessageId,
    { error: "Model not found" },
    original.id,
  );
  const before = storage.getItem(CHAT_STORAGE_KEY);
  assert.throws(() =>
    retryQuestion(storage, session.id, undefined, { model: " " }),
  );
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), before);
  const repaired = retryQuestion(storage, session.id, undefined, {
    model: "correct-model",
    reasoningEffort: "high",
  }).sessions[0];
  assert.deepEqual(repaired.request!.options, {
    model: "correct-model",
    reasoningEffort: "high",
  });
  assert.equal(repaired.messages.length, 1);
  assert.equal(repaired.messages[0].id, original.userMessageId);
  settleQuestion(
    storage,
    session.id,
    original.userMessageId,
    { error: "Temporary failure" },
    repaired.request!.id,
  );
  const retained = retryQuestion(storage, session.id).sessions[0];
  assert.deepEqual(retained.request!.options, repaired.request!.options);
  assert.equal(retained.messages.length, 1);
});
