import { ScrollArea } from "@/components/ui/scroll-area";
import type { LearningBook } from "@/types/book";

export function EmptyBook({ book }: { book: LearningBook }) {
  return (
    <ScrollArea className="document-scroll">
      <article className="reading-document" aria-label={book.title}>
        <header className="document-heading">
          <h1 className="text-[27px] leading-snug font-semibold tracking-tight">
            {book.title}
          </h1>
        </header>
      </article>
    </ScrollArea>
  );
}
