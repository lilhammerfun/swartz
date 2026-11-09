import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/feedback";
import type { LearningBook } from "@/types/book";

export function EmptyBook({ book }: { book: LearningBook }) {
  return (
    <ScrollArea className="document-scroll">
      <article className="reading-document" aria-label={book.title}>
        <header className="document-heading">
          <p className="document-chapter">Textbook</p>
          <h1>{book.title}</h1>
        </header>
        <EmptyState compact icon={null}>
          No chapters yet. Open the project conversation to explore a question.
          Your textbook can grow from what you choose to develop.
        </EmptyState>
      </article>
    </ScrollArea>
  );
}
