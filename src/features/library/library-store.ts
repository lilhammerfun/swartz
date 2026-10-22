import type { LearningBook } from "../../types/book.ts";

export const LIBRARY_STORAGE_KEY = "tukdam.library.books.v1";
const MAX_TITLE_LENGTH = 160;

export function blankBook(id: string, title: string): LearningBook {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > MAX_TITLE_LENGTH)
    throw new Error("Enter a book title of 1–160 characters.");
  return { id, title: trimmed, subtitle: "", version: 1, chapters: [] };
}

export function parseLibrary(raw: string): LearningBook[] {
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Invalid library.");
  const ids = new Set<string>();
  return data.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid book.");
    const { id, title } = item as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      !id.startsWith("book-") ||
      ids.has(id) ||
      typeof title !== "string"
    )
      throw new Error("Invalid book.");
    ids.add(id);
    return blankBook(id, title);
  });
}

export function createStoredBook(
  storage: Pick<Storage, "getItem" | "setItem">,
  title: string,
): { book: LearningBook; books: LearningBook[] } {
  // Read the latest snapshot so another tab's books are preserved.
  const books = parseLibrary(storage.getItem(LIBRARY_STORAGE_KEY) ?? "[]");
  const book = blankBook(`book-${crypto.randomUUID()}`, title);
  const next = [...books, book];
  storage.setItem(
    LIBRARY_STORAGE_KEY,
    JSON.stringify(next.map(({ id, title }) => ({ id, title }))),
  );
  return { book, books: next };
}
