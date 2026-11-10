import type { ReactNode } from "react";

export function TextbookPanel({ children }: { children: ReactNode }) {
  return (
    <aside id="textbook-panel" className="textbook-panel" aria-label="Textbook">
      {children}
    </aside>
  );
}
