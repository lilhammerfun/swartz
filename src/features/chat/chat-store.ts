import type { PromptAttachment } from "../../types/book.ts";
import type { ModelRequestOptions } from "../model/model-api.ts";

export const CHAT_STORAGE_KEY = "tukdam.chat.v1";
export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  attachments?: PromptAttachment[];
}
export interface ChatRequest {
  id: string;
  status: "pending" | "error" | "interrupted";
  userMessageId: string;
  options: ModelRequestOptions;
  error?: string;
}
export interface ChatSession {
  id: string;
  title: string;
  bookId?: string;
  createdAt: string;
  updatedAt: string;
  draft: string;
  draftAttachments: PromptAttachment[];
  messages: ConversationMessage[];
  request?: ChatRequest;
}
export interface ChatSnapshot {
  version: 1;
  homeDraft: string;
  homeAttachments: PromptAttachment[];
  sessions: ChatSession[];
}
export type ChatStorage = Pick<Storage, "getItem" | "setItem">;
export const emptyChat = (): ChatSnapshot => ({
  version: 1,
  homeDraft: "",
  homeAttachments: [],
  sessions: [],
});
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown, max = 120000): value is string {
  return typeof value === "string" && value.length <= max;
}
function date(value: unknown): value is string {
  return text(value, 64) && Number.isFinite(Date.parse(value));
}
export function validateAttachments(
  value: unknown,
): value is PromptAttachment[] {
  return (
    Array.isArray(value) &&
    value.length <= 4 &&
    value.every(
      (file) =>
        record(file) &&
        text(file.id, 128) &&
        !!file.id &&
        text(file.name, 1024) &&
        !!file.name &&
        text(file.text, 20000) &&
        !!file.text.trim() &&
        !file.text.includes("\0"),
    ) &&
    value.reduce((length, file) => length + file.text.length, 0) <= 60000
  );
}
function optionsValid(value: unknown): value is ModelRequestOptions {
  return (
    record(value) &&
    (value.model === undefined ||
      (text(value.model, 256) && !!value.model.trim())) &&
    (value.reasoningEffort === undefined ||
      ["none", "low", "medium", "high", "max"].includes(
        value.reasoningEffort as string,
      ))
  );
}
export function parseChat(raw: string): ChatSnapshot {
  const data: unknown = JSON.parse(raw);
  if (
    !record(data) ||
    data.version !== 1 ||
    !text(data.homeDraft) ||
    !validateAttachments(data.homeAttachments) ||
    !Array.isArray(data.sessions)
  )
    throw new Error(
      "The saved conversations could not be read. Existing data was kept.",
    );
  const ids = new Set<string>();
  for (const session of data.sessions) {
    if (
      !record(session) ||
      !text(session.id, 128) ||
      !session.id.startsWith("chat-") ||
      ids.has(session.id) ||
      !text(session.title, 160) ||
      !session.title.trim() ||
      !date(session.createdAt) ||
      !date(session.updatedAt) ||
      !text(session.draft) ||
      !validateAttachments(session.draftAttachments) ||
      (session.bookId !== undefined && !text(session.bookId, 256)) ||
      !Array.isArray(session.messages)
    )
      throw new Error(
        "The saved conversations could not be read. Existing data was kept.",
      );
    ids.add(session.id);
    const messageIds = new Set<string>();
    for (const message of session.messages) {
      if (
        !record(message) ||
        !text(message.id, 128) ||
        !message.id ||
        messageIds.has(message.id) ||
        !["user", "assistant"].includes(message.role as string) ||
        !text(message.text) ||
        !message.text.trim() ||
        !date(message.createdAt) ||
        (message.attachments !== undefined &&
          !validateAttachments(message.attachments))
      )
        throw new Error(
          "The saved conversation contains an invalid message. Existing data was kept.",
        );
      messageIds.add(message.id);
    }
    const request = session.request;
    const last = session.messages.at(-1);
    if (
      request !== undefined &&
      (!record(request) ||
        !text(request.id, 128) ||
        !request.id ||
        !["pending", "error", "interrupted"].includes(
          request.status as string,
        ) ||
        request.userMessageId !== last?.id ||
        last?.role !== "user" ||
        !optionsValid(request.options) ||
        (request.error !== undefined && !text(request.error, 2000)))
    )
      throw new Error(
        "The saved request could not be read. Existing data was kept.",
      );
  }
  return data as unknown as ChatSnapshot;
}
export function readChat(storage: ChatStorage): ChatSnapshot {
  const raw = storage.getItem(CHAT_STORAGE_KEY);
  return raw === null ? emptyChat() : parseChat(raw);
}
export function updateChat(
  storage: ChatStorage,
  change: (snapshot: ChatSnapshot) => void,
): ChatSnapshot {
  const next = readChat(storage);
  change(next);
  const serialized = JSON.stringify(next);
  parseChat(serialized);
  storage.setItem(CHAT_STORAGE_KEY, serialized);
  return next;
}
export function recoverChat(storage: ChatStorage): ChatSnapshot {
  const current = readChat(storage);
  if (
    !current.sessions.some((session) => session.request?.status === "pending")
  )
    return current;
  return updateChat(storage, (snapshot) => {
    for (const session of snapshot.sessions) {
      if (session.request?.status === "pending") {
        session.request.status = "interrupted";
        session.request.error =
          "The request was interrupted. Retry to continue.";
      }
    }
  });
}
export function queueQuestion(
  storage: ChatStorage,
  input: {
    sessionId?: string;
    bookId?: string;
    text: string;
    attachments: PromptAttachment[];
    options: ModelRequestOptions;
  },
): { snapshot: ChatSnapshot; session: ChatSession } {
  const question = input.text.trim();
  if (
    !question ||
    question.length > 120000 ||
    !validateAttachments(input.attachments) ||
    !optionsValid(input.options)
  )
    throw new Error(
      "Enter a question with valid text or Markdown attachments.",
    );
  let result!: ChatSession;
  const snapshot = updateChat(storage, (current) => {
    const now = new Date().toISOString();
    let session = input.sessionId
      ? current.sessions.find((item) => item.id === input.sessionId)
      : undefined;
    if (input.sessionId && !session)
      throw new Error("This conversation could not be found.");
    if (session?.request)
      throw new Error("Retry the unanswered question before continuing.");
    if (!session) {
      session = {
        id: `chat-${crypto.randomUUID()}`,
        title: question.slice(0, 160),
        ...(input.bookId ? { bookId: input.bookId } : {}),
        createdAt: now,
        updatedAt: now,
        draft: "",
        draftAttachments: [],
        messages: [],
      };
      current.sessions.unshift(session);
      current.homeDraft = "";
      current.homeAttachments = [];
    }
    session.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      text: question,
      createdAt: now,
      ...(input.attachments.length
        ? { attachments: structuredClone(input.attachments) }
        : {}),
    });
    session.request = {
      id: crypto.randomUUID(),
      status: "pending",
      userMessageId: session.messages.at(-1)!.id,
      options: { ...input.options },
    };
    session.draft = "";
    session.draftAttachments = [];
    session.updatedAt = now;
    result = session;
  });
  return { snapshot, session: result };
}
export function retryQuestion(
  storage: ChatStorage,
  sessionId: string,
  failedPendingId?: string,
  options?: ModelRequestOptions,
) {
  return updateChat(storage, (snapshot) => {
    const session = snapshot.sessions.find((item) => item.id === sessionId);
    if (
      !session?.request ||
      (session.request.status === "pending" &&
        session.request.id !== failedPendingId)
    )
      throw new Error("There is no failed question to retry.");
    if (options !== undefined) {
      if (!optionsValid(options))
        throw new Error("Select valid model and effort options.");
      session.request.options = {
        ...(options.model === undefined ? {} : { model: options.model }),
        ...(options.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: options.reasoningEffort }),
      };
    }
    session.request.id = crypto.randomUUID();
    session.request.status = "pending";
    delete session.request.error;
  });
}
export function settleQuestion(
  storage: ChatStorage,
  sessionId: string,
  userMessageId: string,
  result: { answer: string } | { error: string },
  requestId?: string,
) {
  return updateChat(storage, (snapshot) => {
    const session = snapshot.sessions.find((item) => item.id === sessionId);
    if (
      !session?.request ||
      session.request.userMessageId !== userMessageId ||
      (requestId !== undefined && session.request.id !== requestId)
    )
      throw new Error("This request is no longer current.");
    if ("answer" in result) {
      const answer = result.answer.trim();
      if (!answer)
        throw new Error("The model returned no text. Retry your question.");
      session.messages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: answer,
        createdAt: new Date().toISOString(),
      });
      session.updatedAt = new Date().toISOString();
      delete session.request;
    } else {
      session.request.status = "error";
      session.request.error = result.error.slice(0, 2000);
    }
  });
}

export function startBookSession(
  storage: ChatStorage,
  book: { id: string; title: string },
): { snapshot: ChatSnapshot; session: ChatSession } {
  const current = readChat(storage);
  const existing = current.sessions.find(
    (session) => session.bookId === book.id,
  );
  if (existing) return { snapshot: current, session: existing };
  let session!: ChatSession;
  const snapshot = updateChat(storage, (next) => {
    const now = new Date().toISOString();
    session = {
      id: `chat-${crypto.randomUUID()}`,
      title: book.title.slice(0, 160),
      bookId: book.id,
      createdAt: now,
      updatedAt: now,
      draft: "",
      draftAttachments: [],
      messages: [],
    };
    next.sessions.unshift(session);
  });
  return { snapshot, session };
}

export interface FailedChatRequest {
  requestId: string;
  error: string;
}
// Recover only attempts whose result this tab could not persist. Other tabs' live requests stay pending.
export function restoreFailedRequests(
  snapshot: ChatSnapshot,
  failures: ReadonlyMap<string, FailedChatRequest>,
  activeRequestId?: string,
): void {
  for (const session of snapshot.sessions) {
    const failed = failures.get(session.id);
    if (
      failed &&
      session.request?.id === failed.requestId &&
      session.request.status === "pending" &&
      failed.requestId !== activeRequestId
    ) {
      session.request.status = "error";
      session.request.error = failed.error;
    }
  }
}
