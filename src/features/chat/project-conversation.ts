import type { ChatSession } from "./chat-store.ts";

/** A continuous project view over legacy records. Original IDs, drafts and requests stay intact. */
export function projectConversation(
  sessions: readonly ChatSession[],
  projectId: string,
  preferredId?: string,
) {
  const records = sessions
    .filter((session) => session.bookId === projectId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const current =
    records.find((session) => session.request?.status === "pending") ??
    records.find((session) => session.id === preferredId) ??
    records.find((session) => session.request) ??
    records[0];
  const messages = [...records]
    .reverse()
    .flatMap((session) =>
      session.messages.map((message) => ({
        ...message,
        sourceSessionId: session.id,
      })),
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return {
    current,
    messages,
    drafts: records.filter(
      (session) =>
        session.id !== current?.id &&
        (session.draft.trim() ||
          session.draftAttachments.length ||
          session.draftPassage),
    ),
    unanswered: records.filter(
      (session) => session.id !== current?.id && session.request,
    ),
  };
}

/** Give the Tutor the same project history the reader sees, with the current input last. */
export function projectRunSession(
  sessions: readonly ChatSession[],
  session: ChatSession,
): ChatSession {
  if (!session.bookId) return session;
  const questionId =
    session.request?.kind === "start_learning"
      ? undefined
      : session.request?.userMessageId;
  const question = session.messages.find(
    (message) => message.id === questionId,
  );
  const history = sessions
    .filter((record) => record.bookId === session.bookId)
    .flatMap((record) =>
      record.id === session.id
        ? session.messages.filter((message) => message !== question)
        : record.messages,
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return { ...session, messages: question ? [...history, question] : history };
}
