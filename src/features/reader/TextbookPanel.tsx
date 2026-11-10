import { useRef, type ReactNode } from "react";
import { DocumentOutline } from "./DocumentOutline";

export function TextbookPanel({ children }: { children: ReactNode }) {
  const container = useRef<HTMLElement>(null);
  return (
    <aside
      ref={container}
      id="textbook-panel"
      className="textbook-panel"
      aria-label="Textbook"
    >
      <DocumentOutline containerRef={container} />
      {children}
    </aside>
  );
}
