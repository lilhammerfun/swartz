import type { Annotation } from "../../types/book.ts";
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  migrateAnnotations,
  parseAnnotations,
} from "../annotations/annotation-store.ts";
import {
  readChat,
  updateChat,
  type ChatSession,
  type ChatStorage,
} from "./chat-store.ts";

/** One-time, idempotent copy. Original annotation snapshots remain untouched. */
export function importAnnotationSessions(storage: ChatStorage) {
  const current = readChat(storage);
  const raw = storage.getItem(STORAGE_KEY);
  const annotations =
    raw === null
      ? migrateAnnotations(
          parseAnnotations(storage.getItem(LEGACY_STORAGE_KEY) ?? "[]"),
        )
      : parseAnnotations(raw);
  const missing = annotations.filter(
    (annotation) =>
      !current.sessions.some(
        (session) => session.legacyAnnotationId === annotation.id,
      ),
  );
  if (!missing.length) return current;
  return updateChat(storage, (next) => {
    for (const annotation of missing) {
      if (
        next.sessions.some(
          (session) => session.legacyAnnotationId === annotation.id,
        )
      )
        continue;
      next.sessions.push({
        id: `chat-annotation-${annotation.id}`,
        legacyAnnotationId: annotation.id,
        bookId: annotation.anchor.bookId,
        title: annotation.text.slice(0, 160),
        createdAt: annotation.createdAt,
        updatedAt: annotation.createdAt,
        draft: "",
        draftAttachments: [],
        messages: [
          {
            id: annotation.id,
            role: "user",
            text: annotation.text,
            createdAt: annotation.createdAt,
            passage: annotation.anchor,
            ...(annotation.attachments
              ? { attachments: annotation.attachments }
              : {}),
          },
          ...annotation.messages.map((message) => ({
            ...message,
            id: `legacy-${message.id}`,
            createdAt: annotation.createdAt,
          })),
        ],
      });
    }
  });
}

/** Reader marks are a projection of quoted messages, never a separate conversation. */
export function sessionPassages(
  sessions: readonly ChatSession[],
): Annotation[] {
  return sessions.flatMap((session) =>
    session.messages.flatMap((message) =>
      message.role === "user" && message.passage
        ? [
            {
              id: message.id,
              kind: "question" as const,
              anchor: message.passage,
              text: message.text,
              createdAt: message.createdAt,
              messages: [],
              attachments: message.attachments,
            },
          ]
        : [],
    ),
  );
}
