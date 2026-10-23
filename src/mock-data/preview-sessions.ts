import {
  readChat,
  updateChat,
  CHAT_STORAGE_KEY,
  type ChatSession,
  type ChatStorage,
} from "../features/chat/chat-store.ts";

/** One-time cleanup of empty preview sessions; back up the exact snapshot first. */
export function cleanupEmptyPreviewSessions(storage: ChatStorage) {
  const marker = "tukdam.preview-empty-cleanup.v1";
  const backup = "tukdam.preview-empty-cleanup.backup.v1";
  const current = readChat(storage);
  if (storage.getItem(marker) !== null) return current;
  const removable = (session: ChatSession) =>
    session.messages.length === 0 &&
    !session.request &&
    session.draft.length === 0 &&
    session.draftAttachments.length === 0 &&
    !session.draftPassage &&
    (session.title === "New session" ||
      session.title === "Ownership & Borrowing");
  let next = current;
  if (current.sessions.some(removable)) {
    if (storage.getItem(backup) === null)
      storage.setItem(backup, storage.getItem(CHAT_STORAGE_KEY)!);
    next = updateChat(storage, (snapshot) => {
      snapshot.sessions = snapshot.sessions.filter(
        (session) => !removable(session),
      );
    });
  }
  storage.setItem(marker, "done");
  return next;
}
