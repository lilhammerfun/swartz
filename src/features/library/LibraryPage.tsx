import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LearningBook } from "@/types/book";

export function LibraryPage({
  books,
  onOpen,
}: {
  books: readonly LearningBook[];
  onOpen: (book: LearningBook) => void;
}) {
  return (
    <section className="library-page-scroll" aria-label="Library">
      <div className="library-page">
        <div className="space-y-3">
          {books.map((book) => (
            <Card key={book.id} className="gap-0 py-0 shadow-none">
              <CardContent className="p-0">
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start gap-5 rounded-xl p-5 text-left"
                  onClick={() => onOpen(book)}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                    <BookOpen className="size-5 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="line-clamp-2 whitespace-normal font-medium">
                      {book.title}
                    </span>
                    {book.subtitle && (
                      <span className="block whitespace-normal text-sm font-normal text-muted-foreground">
                        {book.subtitle}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
