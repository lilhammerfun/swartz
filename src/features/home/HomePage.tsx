import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuestionInput } from "@/features/annotations/QuestionInput";
import type { PromptSubmission } from "@/features/annotations/prompt-options";
import type { ModelSettings } from "@/features/model/model-api";
import type { PromptAttachment } from "@/types/book";

export interface HomeComposerProps {
  value: string;
  onChange: (value: string) => void;
  settings: ModelSettings;
  pending: boolean;
  busy: boolean;
  error?: string;
  onSettings: () => void;
  onConfigure?: () => void;
  onSend: (submission: PromptSubmission) => Promise<boolean>;
  attachments?: PromptAttachment[];
  onAttachmentsChange?: (attachments: PromptAttachment[]) => void;
}

export interface HomePageProps extends HomeComposerProps {
  recentBooks?: { id: string; title: string; subtitle: string }[];
  onResume: (bookId: string) => void;
}

export function HomePage({
  recentBooks = [],
  onResume,
  ...composer
}: HomePageProps) {
  return (
    <ScrollArea className="h-full min-h-0 flex-1">
      <section
        className="mx-auto w-full max-w-2xl px-6 pt-[clamp(48px,18vh,160px)] pb-12"
        aria-label="Start learning"
      >
        <QuestionInput
          {...composer}
          label="Start a conversation"
          placeholder="What would you like to explore?"
        />
        {recentBooks.length > 0 && (
          <div className="mt-12 space-y-2">
            <h2 className="px-2 text-xs font-medium text-muted-foreground">
              Continue learning
            </h2>
            {recentBooks.slice(0, 3).map((book) => (
              <Button
                key={book.id}
                variant="ghost"
                className="h-auto w-full justify-start gap-4 px-2 py-3 text-left font-normal"
                onClick={() => onResume(book.id)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-medium">
                    {book.title}
                  </span>
                  {book.subtitle && (
                    <span className="truncate text-xs text-muted-foreground">
                      {book.subtitle}
                    </span>
                  )}
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            ))}
          </div>
        )}
      </section>
    </ScrollArea>
  );
}
