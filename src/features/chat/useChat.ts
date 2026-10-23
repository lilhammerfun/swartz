import { useEffect, useRef, useState } from "react";
import type {
  AnnotationAnchor,
  LearningBook,
  PromptAttachment,
} from "../../types/book";
import type { PromptSubmission } from "../annotations/prompt-options";
import { askModel } from "../model/model-service";
import type { ModelRequestOptions } from "../model/model-api";
import { ordinaryChatMessages } from "./chat-messages";
import { importAnnotationSessions } from "./session-passages";
import { cleanupEmptyPreviewSessions } from "../../mock-data/preview-sessions";
import { seedOrganizeConversation } from "../../mock-data/organize-conversation";
import {
  CHAT_STORAGE_KEY,
  emptyChat,
  queueQuestion,
  readChat,
  recoverChat,
  restoreFailedRequests,
  retryQuestion,
  settleQuestion,
  startBookSession,
  updateChat,
  type ChatSession,
  type ChatSnapshot,
  type FailedChatRequest,
} from "./chat-store";

function errorMessage(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : typeof cause === "string"
      ? cause
      : "The conversation could not be saved. Your previous data was kept.";
}
export function useChat() {
  const [snapshot, setSnapshot] = useState<ChatSnapshot>(emptyChat);
  const [error, setError] = useState("");
  const [pendingSessionId, setPendingSessionId] = useState<string>();
  const activeRequest = useRef<string | undefined>(undefined);
  const loaded = useRef(false);
  const failedPending = useRef(new Map<string, FailedChatRequest>());
  function acceptSnapshot(next: ChatSnapshot) {
    restoreFailedRequests(next, failedPending.current, activeRequest.current);
    // Once another attempt has replaced ours, its result must never be resurrected.
    for (const [sessionId, failed] of failedPending.current) {
      if (
        next.sessions.find((session) => session.id === sessionId)?.request
          ?.id !== failed.requestId
      )
        failedPending.current.delete(sessionId);
    }
    setSnapshot(next);
  }
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      acceptSnapshot(readChat(localStorage));
      importAnnotationSessions(localStorage);
      if (import.meta.env.DEV) {
        cleanupEmptyPreviewSessions(localStorage);
        seedOrganizeConversation(localStorage);
      }
      acceptSnapshot(recoverChat(localStorage));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== CHAT_STORAGE_KEY) return;
      try {
        acceptSnapshot(readChat(localStorage));
      } catch (cause) {
        setError(errorMessage(cause));
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function saveDraft(change: (next: ChatSnapshot) => void) {
    // Keep controlled inputs responsive even when persistence is unavailable.
    setSnapshot((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });
    try {
      acceptSnapshot(
        updateChat(localStorage, (next) => {
          restoreFailedRequests(
            next,
            failedPending.current,
            activeRequest.current,
          );
          change(next);
        }),
      );
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  async function run(
    session: ChatSession,
    book?: LearningBook,
  ): Promise<boolean> {
    const request = session.request!;
    activeRequest.current = request.id;
    setPendingSessionId(session.id);
    setError("");
    try {
      const answer = await askModel(
        ordinaryChatMessages(session, book),
        request.options,
      );
      if (activeRequest.current !== request.id) return false;
      acceptSnapshot(
        settleQuestion(
          localStorage,
          session.id,
          request.userMessageId,
          {
            answer,
          },
          request.id,
        ),
      );
      return true;
    } catch (cause) {
      if (activeRequest.current !== request.id) return false;
      const message = errorMessage(cause);
      try {
        acceptSnapshot(
          settleQuestion(
            localStorage,
            session.id,
            request.userMessageId,
            {
              error: message,
            },
            request.id,
          ),
        );
      } catch {
        failedPending.current.set(session.id, {
          requestId: request.id,
          error: message,
        });
        // The persisted pending question remains recoverable after reload even if storage is full.
        setSnapshot((current) => ({
          ...current,
          sessions: current.sessions.map((item) =>
            item.id === session.id && item.request?.id === request.id
              ? {
                  ...item,
                  request: { ...item.request, status: "error", error: message },
                }
              : item,
          ),
        }));
      }
      setError(message);
      return false;
    } finally {
      if (activeRequest.current === request.id) {
        activeRequest.current = undefined;
        setPendingSessionId(undefined);
      }
    }
  }
  async function send(input: {
    sessionId?: string;
    book?: LearningBook;
    text: string;
    submission: PromptSubmission;
    onSessionReady?: (id: string) => void;
  }): Promise<string | undefined> {
    if (activeRequest.current) return undefined;
    try {
      const options = {
        model: input.submission.model,
        reasoningEffort: input.submission.reasoningEffort,
      };
      // Validate the complete request before queuing, including book context and previous attachments.
      const previous = input.sessionId
        ? readChat(localStorage).sessions.find(
            (session) => session.id === input.sessionId,
          )
        : undefined;
      const candidate = {
        ...previous,
        bookId: previous?.bookId ?? input.book?.id,
        messages: [
          ...(previous?.messages ?? []),
          {
            id: "candidate",
            role: "user" as const,
            text: input.text.trim(),
            createdAt: new Date().toISOString(),
            attachments: input.submission.attachments,
            ...(previous?.draftPassage
              ? { passage: previous.draftPassage }
              : {}),
          },
        ],
      } as ChatSession;
      ordinaryChatMessages(candidate, input.book);
      const queued = queueQuestion(localStorage, {
        sessionId: input.sessionId,
        bookId: input.book?.id,
        text: input.text,
        attachments: input.submission.attachments,
        options,
        passage: previous?.draftPassage,
      });
      acceptSnapshot(queued.snapshot);
      // Claim the single-flight slot before navigation can cause another submission.
      activeRequest.current = queued.session.request!.id;
      input.onSessionReady?.(queued.session.id);
      return (await run(queued.session, input.book))
        ? queued.session.id
        : undefined;
    } catch (cause) {
      activeRequest.current = undefined;
      setError(errorMessage(cause));
      return undefined;
    }
  }
  async function retry(
    sessionId: string,
    book?: LearningBook,
    options?: ModelRequestOptions,
  ): Promise<boolean> {
    if (activeRequest.current) return false;
    try {
      const current = readChat(localStorage).sessions.find(
        (item) => item.id === sessionId,
      );
      if (!current) throw new Error("This conversation could not be found.");
      ordinaryChatMessages(current, book);
      const next = retryQuestion(
        localStorage,
        sessionId,
        failedPending.current.get(sessionId)?.requestId,
        options,
      );
      failedPending.current.delete(sessionId);
      acceptSnapshot(next);
      return await run(
        next.sessions.find((session) => session.id === sessionId)!,
        book,
      );
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
  }
  return {
    sessions: snapshot.sessions,
    homeDraft: snapshot.homeDraft,
    homeAttachments: snapshot.homeAttachments,
    error,
    busy: !!pendingSessionId,
    pendingSessionId,
    getSession: (id: string) =>
      snapshot.sessions.find((session) => session.id === id),
    setHomeDraft: (value: string) =>
      saveDraft((next) => {
        next.homeDraft = value;
      }),
    setHomeAttachments: (files: PromptAttachment[]) =>
      saveDraft((next) => {
        next.homeAttachments = files;
      }),
    setDraft: (id: string, value: string) =>
      saveDraft((next) => {
        const session = next.sessions.find((item) => item.id === id);
        if (session) session.draft = value;
      }),
    setDraftAttachments: (id: string, files: PromptAttachment[]) =>
      saveDraft((next) => {
        const session = next.sessions.find((item) => item.id === id);
        if (session) session.draftAttachments = files;
      }),
    setDraftPassage: (id: string, passage?: AnnotationAnchor) =>
      saveDraft((next) => {
        const session = next.sessions.find((item) => item.id === id);
        if (!session) return;
        if (passage) session.draftPassage = structuredClone(passage);
        else delete session.draftPassage;
      }),
    startSession: (
      book: LearningBook,
      createNew = false,
    ): string | undefined => {
      try {
        const result = startBookSession(localStorage, book, createNew);
        acceptSnapshot(result.snapshot);
        setError("");
        return result.session.id;
      } catch (cause) {
        setError(errorMessage(cause));
        return undefined;
      }
    },
    send,
    retry,
  };
}
