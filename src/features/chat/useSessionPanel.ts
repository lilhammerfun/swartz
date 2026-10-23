import { useRef, useState } from "react";
import type { AnnotationAnchor } from "@/types/book";

export interface SessionPanelState {
  open: boolean;
  tabs: string[];
  active: string;
  pendingPassage?: AnnotationAnchor;
  passageMessageIds?: string[];
}
const emptyPanel = (): SessionPanelState => ({
  open: false,
  tabs: [],
  active: "list",
});

export function useSessionPanel(bookId: string) {
  const [panels, setPanels] = useState<Record<string, SessionPanelState>>({});
  const scrollPositions = useRef(new Map<string, number>());
  const state = panels[bookId] ?? emptyPanel();
  function change(update: (current: SessionPanelState) => SessionPanelState) {
    setPanels((current) => ({
      ...current,
      [bookId]: update(current[bookId] ?? emptyPanel()),
    }));
  }
  return {
    ...state,
    scrollPositions: scrollPositions.current,
    setOpen: (open: boolean) => change((current) => ({ ...current, open })),
    showList: (passageMessageIds?: string[]) =>
      change((current) => ({
        ...current,
        open: true,
        active: "list",
        passageMessageIds,
      })),
    openSession: (id: string, targetBookId = bookId) =>
      setPanels((panels) => {
        const current = panels[targetBookId] ?? emptyPanel();
        return {
          ...panels,
          [targetBookId]: {
            ...current,
            open: true,
            active: id,
            passageMessageIds: undefined,
            tabs: current.tabs.includes(id)
              ? current.tabs
              : [...current.tabs, id],
          },
        };
      }),
    closeSession: (id: string) =>
      change((current) => ({
        ...current,
        tabs: current.tabs.filter((tab) => tab !== id),
        active: current.active === id ? "list" : current.active,
      })),
    setPendingPassage: (pendingPassage?: AnnotationAnchor) =>
      change((current) => ({
        ...current,
        open: true,
        pendingPassage,
      })),
  };
}
