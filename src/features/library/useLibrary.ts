import { useEffect, useState } from "react";
import type { LearningBook } from "@/types/book";
import {
  createStoredBook,
  LIBRARY_STORAGE_KEY,
  parseLibrary,
} from "./library-store";

function load(starter: LearningBook) {
  try {
    return {
      books: [
        starter,
        ...parseLibrary(localStorage.getItem(LIBRARY_STORAGE_KEY) ?? "[]"),
      ],
      error: "",
    };
  } catch {
    return {
      books: [starter],
      error: "Unable to load your library. Stored data has not been changed.",
    };
  }
}

export function useLibrary(starter: LearningBook) {
  const [snapshot, setSnapshot] = useState(() => load(starter));
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === LIBRARY_STORAGE_KEY || event.key === null)
        setSnapshot(load(starter));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [starter]);
  return {
    ...snapshot,
    retry: () => setSnapshot(load(starter)),
    createBook: (title: string) => {
      try {
        const { book, books } = createStoredBook(localStorage, title);
        setSnapshot({ books: [starter, ...books], error: "" });
        return book;
      } catch {
        throw new Error(
          "Could not save this book. Check local storage and try again.",
        );
      }
    },
  };
}
