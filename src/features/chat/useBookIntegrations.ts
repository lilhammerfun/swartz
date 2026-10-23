import { useEffect, useState } from "react";
import type { LearningBook } from "@/types/book";
import type { ChatSession } from "./chat-store";
import {
  INTEGRATION_KEY,
  integrateConversation,
  projectBook,
  readIntegrations,
  undoIntegration,
  type BookIntegration,
} from "./book-integration";

function load() {
  try {
    return { entries: readIntegrations(localStorage), error: "" };
  } catch (cause) {
    return {
      entries: [] as BookIntegration[],
      error:
        cause instanceof Error
          ? cause.message
          : "Could not load book additions.",
    };
  }
}
export function useBookIntegrations() {
  const [state, setState] = useState(load);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === INTEGRATION_KEY || event.key === null) setState(load());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return {
    ...state,
    project: (book: LearningBook) => projectBook(book, state.entries),
    undo: (id: string) => {
      const entries = undoIntegration(localStorage, id);
      setState({ entries, error: "" });
    },
    integrate: (session: ChatSession, book: LearningBook) => {
      const entries = integrateConversation(localStorage, session, book);
      setState({ entries, error: "" });
      return entries.at(-1)!;
    },
  };
}
