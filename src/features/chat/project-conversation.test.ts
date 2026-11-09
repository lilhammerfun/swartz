import assert from "node:assert/strict";
import test from "node:test";
import {
  projectConversation,
  projectRunSession,
} from "./project-conversation.ts";
import {
  CHAT_STORAGE_KEY,
  emptyChat,
  parseChat,
  queueStartLearning,
  recoverChat,
  retryQuestion,
  settleQuestion,
  type ChatSession,
} from "./chat-store.ts";
import { prepareTutorRequest } from "./tutor-request.ts";

function record(id: string, project = "rust", day = "01"): ChatSession {
  const date = `2026-11-${day}T09:00:00Z`;
  return {
    id: `chat-${id}`,
    bookId: project,
    title: id,
    createdAt: date,
    updatedAt: date,
    draft: "",
    draftAttachments: [],
    messages: [
      { id: `question-${id}`, role: "user", text: id, createdAt: date },
    ],
  };
}
function storageFor(sessions: ChatSession[]) {
  const data = new Map([
    [CHAT_STORAGE_KEY, JSON.stringify({ ...emptyChat(), sessions })],
  ]);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

test("the project timeline keeps every legacy record, quote identity and unsent draft without rewriting storage", () => {
  const older = record("older");
  older.draft = "An unfinished explanation";
  older.draftPassage = {
    bookId: "rust",
    chapterId: "ownership",
    sectionId: "borrowing",
    paragraphId: "p1",
    version: 1,
    quote: "Original wording",
  };
  older.messages[0].passage = structuredClone(older.draftPassage);
  const newer = record("newer", "rust", "02");
  const sessions = [record("unrelated", "other"), newer, older];
  const before = structuredClone(sessions);
  const view = projectConversation(sessions, "rust");
  assert.equal(view.current?.id, newer.id);
  assert.deepEqual(
    view.messages.map((message) => message.id),
    ["question-older", "question-newer"],
  );
  assert.equal(view.messages[0].sourceSessionId, older.id);
  assert.equal(view.messages[0].passage?.quote, "Original wording");
  assert.deepEqual(view.drafts, [older]);
  assert.equal(
    projectConversation(sessions, "rust", older.id).current?.draft,
    older.draft,
  );
  assert.deepEqual(sessions, before);
});

test("an active native request stays selected and earlier failed responses remain reviewable", () => {
  const older = record("older");
  older.request = {
    id: "old-request",
    status: "error",
    userMessageId: "question-older",
    options: {},
    error: "Offline",
  };
  const newer = record("newer", "rust", "02");
  newer.request = {
    id: "live-request",
    status: "pending",
    userMessageId: "question-newer",
    options: {},
  };
  const view = projectConversation([older, newer], "rust", older.id);
  assert.equal(view.current?.id, newer.id);
  assert.deepEqual(view.unanswered, [older]);
});

test("continuing an older draft includes later project history exactly once, with its input last", () => {
  const older = record("older");
  older.messages.push({
    id: "followup",
    role: "user",
    text: "Continue the draft",
    createdAt: "2026-11-03T09:00:00Z",
  });
  older.request = {
    id: "request",
    status: "pending",
    userMessageId: "followup",
    options: {},
  };
  const newer = record("newer", "rust", "02");
  const sessions = [older, record("unrelated", "other"), newer];
  const request = prepareTutorRequest(projectRunSession(sessions, older));
  assert.deepEqual(
    request.history.map((message) => message.id),
    ["question-older", "question-newer"],
  );
  assert.equal(
    request.input.kind === "question" && request.input.message.id,
    "followup",
  );
  assert.equal(older.messages.length, 2);
});

test("Start learning uses the native business contract without adding a user message or consuming a draft", () => {
  const session = record("first");
  session.draft = "Keep my draft";
  session.draftAttachments = [
    { id: "notes", name: "notes.md", text: "Draft notes" },
  ];
  const storage = storageFor([session]);
  const queued = queueStartLearning(storage, session.id, {
    model: "local-model",
  });
  const wire = prepareTutorRequest(queued.session);
  assert.deepEqual(wire.input, { kind: "start_learning" });
  assert.deepEqual(wire.target, { kind: "project", projectId: "rust" });
  assert.deepEqual(wire.history, session.messages);
  assert.equal(queued.session.messages.length, 1);
  assert.equal(queued.session.draft, session.draft);
  assert.deepEqual(queued.session.draftAttachments, session.draftAttachments);
  assert.doesNotThrow(() => parseChat(storage.getItem(CHAT_STORAGE_KEY)!));
  assert.throws(
    () => queueStartLearning(storage, session.id, {}),
    /unanswered/,
  );
  const interrupted = recoverChat(storage).sessions[0];
  assert.equal(interrupted.request?.status, "interrupted");
  const retried = retryQuestion(storage, session.id).sessions[0];
  assert.deepEqual(prepareTutorRequest(retried).input, {
    kind: "start_learning",
  });
  const settled = settleQuestion(
    storage,
    session.id,
    retried.request!.userMessageId,
    { answer: "Let’s start from ownership." },
    retried.request!.id,
  ).sessions[0];
  assert.deepEqual(
    settled.messages.map((message) => message.role),
    ["user", "assistant"],
  );
  assert.equal(settled.request, undefined);
  assert.equal(settled.draft, session.draft);
});

test("Start learning also works before the first message and cannot target an unassigned Home conversation", () => {
  const project = record("empty");
  project.messages = [];
  const storage = storageFor([project]);
  const queued = queueStartLearning(storage, project.id, {});
  assert.deepEqual(prepareTutorRequest(queued.session).history, []);
  const unassigned = record("home");
  delete unassigned.bookId;
  assert.throws(
    () => queueStartLearning(storageFor([unassigned]), unassigned.id, {}),
    /Open a project/,
  );
});
