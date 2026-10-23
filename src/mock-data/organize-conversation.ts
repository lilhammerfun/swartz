import { learningBook } from "./book.ts";
import {
  readChat,
  updateChat,
  type ChatStorage,
} from "../features/chat/chat-store.ts";

/** Development fixture, seeded once. Organizing it never causes it to reappear. */
export function seedOrganizeConversation(storage: ChatStorage) {
  const id = "chat-preview-clean-library";
  if (readChat(storage).sessions.some((session) => session.id === id)) return;
  const chapter = learningBook.chapters.find(
    (item) => item.id === "borrowing",
  )!;
  const section = chapter.sections.find((item) => item.id === "mutable")!;
  const paragraph = section.paragraphs.find(
    (item) => item.id === "mutable-rule",
  )!;
  const createdAt = new Date().toISOString();
  updateChat(storage, (snapshot) => {
    snapshot.sessions.unshift({
      id,
      title: "Exploring borrowing",
      bookId: learningBook.id,
      createdAt,
      updatedAt: createdAt,
      draft: "",
      draftAttachments: [],
      messages: [
        {
          id: `${id}-question`,
          role: "user",
          createdAt,
          text: "Why can't a shared reference coexist with a mutable reference? Can you give me a concrete example?",
          passage: {
            bookId: learningBook.id,
            chapterId: chapter.id,
            sectionId: section.id,
            paragraphId: paragraph.id,
            version: learningBook.version,
            quote: paragraph.text,
          },
        },
        {
          id: `${id}-answer`,
          role: "assistant",
          createdAt,
          text: "Imagine reading a list while someone else rearranges its items. The position you just checked may no longer contain the same value.\n\nA shared reference promises stable access. A mutable reference permits changes, so Rust gives it exclusive access while it is in use. This keeps a reader from relying on data that is changing underneath it.",
        },
        {
          id: `${id}-followup`,
          role: "user",
          createdAt,
          text: "So exclusivity is temporary, rather than locking the value forever?",
        },
        {
          id: `${id}-summary`,
          role: "assistant",
          createdAt,
          text: "Exactly. Exclusivity lasts while the mutable reference is in use. After its last use, shared access can resume.\n\nThe useful mental model is a handoff: **one writer, or several readers**. Ownership decides who is responsible for the value; borrowing decides who may access it at a particular point.",
        },
      ],
    });
  });
}
