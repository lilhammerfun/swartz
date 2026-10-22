import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MessageGroup } from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnnotationMessage } from "@/features/annotations/AnnotationMessage";
import { QuestionInput } from "@/features/annotations/QuestionInput";
import type { HomeComposerProps } from "@/features/home/HomePage";
import type { PromptAttachment } from "@/types/book";

export interface ChatViewMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: PromptAttachment[];
  createdAt?: string;
}

export interface ChatPageProps extends HomeComposerProps {
  compact?: boolean;
  messages: ChatViewMessage[];
  onRetry?: () => void;
}

export function ChatPage({
  messages,
  onRetry,
  compact = false,
  ...composer
}: ChatPageProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    const follow = () => {
      const element = viewport.current;
      if (element && atBottom.current) element.scrollTop = element.scrollHeight;
    };
    follow();
    const observer = new ResizeObserver(follow);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [messages, composer.pending]);

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col"
      aria-label="Learning conversation"
    >
      <ScrollArea
        className="min-h-0 flex-1"
        viewportRef={viewport}
        viewportProps={{
          onScroll: (event) => {
            const element = event.currentTarget;
            atBottom.current =
              element.scrollHeight - element.clientHeight - element.scrollTop <
              80;
          },
        }}
      >
        <div
          ref={content}
          className={
            compact
              ? "w-full px-5 pt-5 pb-6"
              : "mx-auto w-full max-w-2xl px-6 pt-8 pb-10"
          }
        >
          <MessageGroup className="gap-8">
            {messages.map((message) => (
              <AnnotationMessage key={message.id} {...message} />
            ))}
          </MessageGroup>
          {composer.pending && (
            <p role="status" className="mt-6 text-sm text-muted-foreground">
              Thinking…
            </p>
          )}
        </div>
      </ScrollArea>
      <div
        className={
          compact
            ? "w-full px-4 pt-2 pb-4"
            : "mx-auto w-full max-w-2xl px-6 pt-2 pb-6"
        }
      >
        <QuestionInput
          {...composer}
          busy={composer.busy || !!onRetry}
          label="Message AI"
          placeholder={
            compact
              ? "What did this bring to mind?"
              : messages.length
                ? "Ask a follow-up…"
                : "What would you like to explore?"
          }
        />
        {composer.error && onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onRetry}
            disabled={composer.busy}
          >
            Retry response
          </Button>
        )}
      </div>
    </section>
  );
}
