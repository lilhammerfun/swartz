import {
  INTEGRATION_KEY,
  integrateConversation,
  undoIntegration,
  sessionIsSynthesized,
  projectBook,
  readIntegrations,
  visibleMessages,
} from "./book-integration.ts";
import assert from "node:assert/strict";
import test from "node:test";
import type { LearningBook } from "../../types/book.ts";
import { learningBook } from "../../mock-data/book.ts";
import { STORAGE_KEY as ANNOTATION_STORAGE_KEY } from "../annotations/annotation-store.ts";
import {
  importAnnotationSessions,
  sessionPassages,
} from "./session-passages.ts";
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
  parseChat,
} from "./chat-store.ts";

const passage = {
  bookId: learningBook.id,
  chapterId: learningBook.chapters[0].id,
  sectionId: learningBook.chapters[0].sections[0].id,
  paragraphId: learningBook.chapters[0].sections[0].paragraphs[0].id,
  version: learningBook.version,
  quote: "One owner per value.",
};

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

test("explicit new sessions in one book keep independent drafts and histories", () => {
  const storage = memoryStorage();
  const first = startBookSession(storage, learningBook, true).session;
  const second = startBookSession(storage, learningBook, true).session;
  assert.notEqual(first.id, second.id);
  updateChat(storage, (next) => {
    next.sessions.find((s) => s.id === first.id)!.draft = "First draft";
    next.sessions.find((s) => s.id === second.id)!.draft = "Second draft";
  });
  queueQuestion(storage, {
    ...question,
    sessionId: first.id,
    bookId: learningBook.id,
  });
  const saved = readChat(storage);
  assert.equal(
    saved.sessions.find((s) => s.id === second.id)!.draft,
    "Second draft",
  );
  assert.equal(
    saved.sessions.find((s) => s.id === second.id)!.messages.length,
    0,
  );
  assert.equal(
    saved.sessions.find((s) => s.id === first.id)!.title,
    question.text,
  );
});

test("quoted context is persisted with its user message, retained on retry, and sent only as context", () => {
  const storage = memoryStorage();
  const session = startBookSession(storage, learningBook, true).session;
  updateChat(storage, (next) => {
    next.sessions[0].draftPassage = passage;
    next.sessions[0].draft = question.text;
  });
  const queued = queueQuestion(storage, {
    ...question,
    sessionId: session.id,
    bookId: learningBook.id,
    passage,
  });
  assert.equal(queued.session.draftPassage, undefined);
  assert.deepEqual(readChat(storage).sessions[0].messages[0].passage, passage);
  const prompt = ordinaryChatMessages(queued.session, learningBook);
  assert.deepEqual(JSON.parse(prompt.at(-1)!.content).selectedPassage, passage);
  settleQuestion(storage, session.id, queued.session.messages[0].id, {
    error: "Offline",
  });
  const retried = retryQuestion(storage, session.id).sessions[0];
  assert.deepEqual(retried.messages[0].passage, passage);
  assert.equal(retried.messages.length, 1);
  settleQuestion(storage, session.id, retried.messages[0].id, {
    answer: "An explanation.",
  });
  const continued = queueQuestion(storage, {
    ...question,
    sessionId: session.id,
    text: "And borrowing?",
    attachments: [],
  });
  assert.equal(continued.session.messages.at(-1)!.passage, undefined);
  const marks = sessionPassages(readChat(storage).sessions);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].id, retried.messages[0].id);
  assert.equal(marks[0].anchor.paragraphId, passage.paragraphId);
});

test("cross-book and malformed passage references cannot overwrite a valid snapshot", () => {
  const storage = memoryStorage();
  const session = startBookSession(storage, learningBook, true).session;
  const before = storage.getItem(CHAT_STORAGE_KEY);
  assert.throws(() =>
    queueQuestion(storage, {
      ...question,
      sessionId: session.id,
      passage: { ...passage, bookId: "another-book" },
    }),
  );
  assert.throws(() =>
    queueQuestion(storage, {
      ...question,
      sessionId: session.id,
      passage: { ...passage, quote: "" },
    }),
  );
  assert.throws(() =>
    updateChat(storage, (next) => {
      next.sessions[0].draftPassage = { ...passage, bookId: "another-book" };
    }),
  );
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), before);
  const queued = queueQuestion(storage, {
    ...question,
    sessionId: session.id,
    passage,
  }).snapshot;
  queued.sessions[0].messages[0].role = "assistant";
  assert.throws(() => parseChat(JSON.stringify(queued)));
});

test("annotation migration preserves original bytes, source identity, attachments, and history without reimporting", () => {
  const storage = memoryStorage();
  startBookSession(storage, learningBook, true);
  const annotation = {
    id: "old-question",
    kind: "question",
    anchor: passage,
    text: question.text,
    attachments: question.attachments,
    createdAt: "2026-10-20T12:00:00Z",
    messages: [
      { id: "reply", role: "assistant", text: "Original response" },
      { id: "follow", role: "user", text: "Another question" },
    ],
  };
  const original = JSON.stringify([annotation]);
  storage.setItem(ANNOTATION_STORAGE_KEY, original);
  const imported = importAnnotationSessions(storage);
  assert.equal(imported.sessions.length, 2);
  const migrated = imported.sessions.find(
    (s) => s.legacyAnnotationId === annotation.id,
  )!;
  assert.deepEqual(
    migrated.messages.map((m) => m.text),
    [question.text, "Original response", "Another question"],
  );
  assert.deepEqual(migrated.messages[0].attachments, question.attachments);
  assert.equal(sessionPassages(imported.sessions)[0].id, annotation.id);
  const continued = queueQuestion(storage, {
    ...question,
    sessionId: migrated.id,
  }).session;
  const again = importAnnotationSessions(storage);
  assert.equal(again.sessions.length, 2);
  assert.equal(
    again.sessions.find((s) => s.id === migrated.id)!.messages.length,
    continued.messages.length,
  );
  assert.equal(storage.getItem(ANNOTATION_STORAGE_KEY), original);
});

test("unreadable legacy data and failed migration writes never replace either original store", () => {
  const storage = memoryStorage();
  startBookSession(storage, learningBook, true);
  const before = storage.getItem(CHAT_STORAGE_KEY);
  storage.setItem(ANNOTATION_STORAGE_KEY, "broken");
  assert.throws(() => importAnnotationSessions(storage));
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), before);
  const original = JSON.stringify([
    {
      id: "old",
      kind: "question",
      text: "Why?",
      anchor: passage,
      createdAt: "2026-10-20T12:00:00Z",
      messages: [],
    },
  ]);
  storage.setItem(ANNOTATION_STORAGE_KEY, original);
  assert.throws(() =>
    importAnnotationSessions({
      getItem: storage.getItem,
      setItem: () => {
        throw new Error("Quota");
      },
    }),
  );
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), before);
  assert.equal(storage.getItem(ANNOTATION_STORAGE_KEY), original);
});

test("organizing preserves original quoted conversations and links a persistent book section", () => {
  const storage = memoryStorage();
  const queued = queueQuestion(storage, {
    bookId: learningBook.id,
    text: "Why exclusive access?",
    attachments: [],
    options: {},
    passage,
  });
  settleQuestion(storage, queued.session.id, queued.session.messages[0].id, {
    answer:
      "A writer needs exclusive access so readers cannot see a changing value.",
  });
  const session = readChat(storage).sessions[0];
  const original = storage.getItem(CHAT_STORAGE_KEY);
  const entries = integrateConversation(storage, session, learningBook);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), original);
  assert.deepEqual(
    entries[0].messageIds,
    session.messages.map((m) => m.id),
  );
  assert.equal(visibleMessages(session, readIntegrations(storage)).length, 0);
  const projected = projectBook(learningBook, readIntegrations(storage));
  assert.ok(
    projected.chapters
      .flatMap((c) => c.sections)
      .some((s) => s.id === entries[0].section.id),
  );
  assert.equal(
    learningBook.chapters
      .flatMap((c) => c.sections)
      .some((s) => s.id === entries[0].section.id),
    false,
  );
  assert.throws(() => integrateConversation(storage, session, learningBook));
  const next = queueQuestion(storage, {
    sessionId: session.id,
    text: "And what about shared access?",
    attachments: [],
    options: {},
  });
  assert.equal(visibleMessages(next.session, entries).length, 1);
});

test("ordinary chat can target an empty book; failed persistence never hides source messages", () => {
  const storage = memoryStorage();
  const queued = queueQuestion(storage, {
    text: "How does ownership work?",
    attachments: [],
    options: {},
  });
  settleQuestion(storage, queued.session.id, queued.session.messages[0].id, {
    answer: "Every value has one owner.",
  });
  const session = readChat(storage).sessions[0];
  const emptyBook = { ...learningBook, id: "empty-book", chapters: [] };
  const original = storage.getItem(CHAT_STORAGE_KEY);
  const entries = integrateConversation(storage, session, emptyBook);
  assert.equal(projectBook(emptyBook, entries).chapters[0].sections.length, 1);
  assert.equal(entries[0].bookId, emptyBook.id);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), original);
  const failure = {
    getItem: () => null,
    setItem: () => {
      throw new Error("Storage full");
    },
  };
  assert.throws(
    () => integrateConversation(failure, session, emptyBook),
    /Storage full/,
  );
  assert.equal(visibleMessages(session, readIntegrations(failure)).length, 2);
});

test("undo restores session visibility and removes only its generated book section", () => {
  const storage = memoryStorage();
  const create = (text: string) => {
    const queued = queueQuestion(storage, {
      bookId: learningBook.id,
      text,
      attachments: [],
      options: {},
    });
    settleQuestion(storage, queued.session.id, queued.session.messages[0].id, {
      answer: "One writer or several readers.",
    });
    return readChat(storage).sessions.find(
      (session) => session.id === queued.session.id,
    )!;
  };
  const first = create("Explain exclusive access.");
  const second = create("Explain shared access.");
  const original = storage.getItem(CHAT_STORAGE_KEY);
  const firstEntry = integrateConversation(storage, first, learningBook)[0];
  const both = integrateConversation(storage, second, learningBook);
  assert.equal(sessionIsSynthesized(first, both), true);
  assert.equal(sessionIsSynthesized(second, both), true);
  const remaining = undoIntegration(storage, firstEntry.id);
  assert.equal(sessionIsSynthesized(first, remaining), false);
  assert.equal(sessionIsSynthesized(second, remaining), true);
  assert.deepEqual(visibleMessages(first, remaining), first.messages);
  assert.equal(remaining.length, 1);
  const sectionIds = projectBook(learningBook, remaining).chapters.flatMap(
    (chapter) => chapter.sections.map((section) => section.id),
  );
  assert.equal(sectionIds.includes(firstEntry.section.id), false);
  assert.equal(sectionIds.includes(remaining[0].section.id), true);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), original);
  assert.deepEqual(undoIntegration(storage, firstEntry.id), remaining);
});

test("a failed undo keeps book content and archived messages consistent", () => {
  const storage = memoryStorage();
  const queued = queueQuestion(storage, {
    text: "Why borrow?",
    attachments: [],
    options: {},
  });
  settleQuestion(storage, queued.session.id, queued.session.messages[0].id, {
    answer: "To access a value without taking ownership.",
  });
  const session = readChat(storage).sessions[0];
  const entries = integrateConversation(storage, session, learningBook);
  const saved = storage.getItem(INTEGRATION_KEY);
  assert.throws(
    () =>
      undoIntegration(
        {
          getItem: storage.getItem,
          setItem: () => {
            throw new Error("Storage full");
          },
        },
        entries[0].id,
      ),
    /Storage full/,
  );
  assert.equal(storage.getItem(INTEGRATION_KEY), saved);
  assert.equal(sessionIsSynthesized(session, readIntegrations(storage)), true);
  assert.equal(readChat(storage).sessions[0].messages.length, 2);
});
