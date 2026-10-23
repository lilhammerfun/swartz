import type { BookSection, LearningBook } from "../../types/book.ts";
import type { ChatSession, ChatStorage } from "./chat-store.ts";

export const INTEGRATION_KEY = "tukdam.book-integrations.preview.v1";
export interface BookIntegration {
  id: string;
  sessionId: string;
  messageIds: string[];
  bookId: string;
  chapterId: string;
  section: BookSection;
  createdAt: string;
}

export function readIntegrations(storage: ChatStorage): BookIntegration[] {
  const data: unknown = JSON.parse(storage.getItem(INTEGRATION_KEY) ?? "[]");
  if (
    !Array.isArray(data) ||
    data.some((entry) => {
      if (!entry || typeof entry !== "object") return true;
      const section = entry.section;
      return (
        ![
          entry.id,
          entry.sessionId,
          entry.bookId,
          entry.chapterId,
          entry.createdAt,
        ].every((v) => typeof v === "string" && v.length > 0) ||
        !Array.isArray(entry.messageIds) ||
        !entry.messageIds.length ||
        !entry.messageIds.every((id: unknown) => typeof id === "string") ||
        !section ||
        typeof section.id !== "string" ||
        typeof section.title !== "string" ||
        typeof section.subtitle !== "string" ||
        !Array.isArray(section.paragraphs) ||
        !section.paragraphs.every(
          (p: unknown) =>
            p &&
            typeof p === "object" &&
            "id" in p &&
            typeof p.id === "string" &&
            "text" in p &&
            typeof p.text === "string",
        )
      );
    })
  )
    throw new Error(
      "Saved book additions could not be loaded. Existing data was kept.",
    );
  return data as BookIntegration[];
}

export function visibleMessages(
  session: ChatSession,
  entries: BookIntegration[],
) {
  const archived = new Set(
    entries
      .filter((e) => e.sessionId === session.id)
      .flatMap((e) => e.messageIds),
  );
  return session.messages.filter((message) => !archived.has(message.id));
}

/** Frontend prototype: reuse existing answers; no model or book-writing service. */
export function integrateConversation(
  storage: ChatStorage,
  session: ChatSession,
  book: LearningBook,
): BookIntegration[] {
  const entries = readIntegrations(storage);
  const messages = visibleMessages(session, entries);
  if (session.request || !messages.some((m) => m.role === "assistant"))
    throw new Error("Finish the conversation before adding it to a book.");
  if (session.bookId && session.bookId !== book.id)
    throw new Error("Choose the book this session belongs to.");
  const source = messages.find((m) => m.passage)?.passage;
  const chapter =
    book.chapters.find((c) => c.id === source?.chapterId) ?? book.chapters[0];
  const sourceSection = chapter?.sections.find(
    (section) => section.id === source?.sectionId,
  );
  const id = crypto.randomUUID();
  const entry: BookIntegration = {
    id,
    sessionId: session.id,
    messageIds: messages.map((m) => m.id),
    bookId: book.id,
    chapterId: chapter?.id ?? `chapter-${id}`,
    createdAt: new Date().toISOString(),
    section: {
      id: `section-${id}`,
      title: sourceSection
        ? `${sourceSection.title}: a closer look`
        : "Key ideas and connections",
      subtitle: "",
      paragraphs: messages
        .filter((m) => m.role === "assistant")
        .map((m, i) => ({ id: `paragraph-${id}-${i}`, text: m.text })),
    },
  };
  const next = [...entries, entry];
  storage.setItem(INTEGRATION_KEY, JSON.stringify(next));
  return next;
}

export function projectBook(
  book: LearningBook,
  entries: BookIntegration[],
): LearningBook {
  const additions = entries.filter((entry) => entry.bookId === book.id);
  if (!additions.length) return book;
  const chapters = book.chapters.map((chapter) => ({
    ...chapter,
    sections: [
      ...chapter.sections,
      ...additions
        .filter((e) => e.chapterId === chapter.id)
        .map((e) => e.section),
    ],
  }));
  for (const entry of additions) {
    if (!chapters.some((c) => c.id === entry.chapterId))
      chapters.push({
        id: entry.chapterId,
        title: "Understanding the topic",
        purpose: "",
        sections: additions
          .filter((e) => e.chapterId === entry.chapterId)
          .map((e) => e.section),
      });
  }
  return { ...book, chapters };
}

/** Hide completed sessions in the UI, while retaining their source messages. */
export function sessionIsSynthesized(
  session: ChatSession,
  entries: BookIntegration[],
) {
  return (
    entries.some((entry) => entry.sessionId === session.id) &&
    visibleMessages(session, entries).length === 0
  );
}

/** Undo only this synthesis, retaining all other book additions and source data. */
export function undoIntegration(
  storage: ChatStorage,
  integrationId: string,
): BookIntegration[] {
  const current = readIntegrations(storage);
  const next = current.filter((entry) => entry.id !== integrationId);
  if (next.length !== current.length)
    storage.setItem(INTEGRATION_KEY, JSON.stringify(next));
  return next;
}
