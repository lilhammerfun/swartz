import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, BookPlus, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/button";
import { MessageGroup } from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnnotationMessage } from "@/features/annotations/AnnotationMessage";
import { QuestionInput } from "@/features/annotations/QuestionInput";
import { PassageQuote } from "@/features/annotations/PassageQuote";
import { useSynthesisTransition } from "./useSynthesisTransition";
import type { HomeComposerProps } from "@/features/home/HomePage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  LearningBook,
  AnnotationAnchor,
  PromptAttachment,
} from "@/types/book";

export interface ChatViewMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: PromptAttachment[];
  createdAt?: string;
  passage?: AnnotationAnchor;
}

export interface ChatPageProps extends HomeComposerProps {
  compact?: boolean;
  targetBooks: LearningBook[];
  needsBookChoice: boolean;
  integrationError?: string;
  onOrganize: (bookId: string) => void;
  messages: ChatViewMessage[];
  onRetry?: () => void;
  sessionId?: string;
  scrollPositions?: Map<string, number>;
  draftPassage?: AnnotationAnchor;
  onRemovePassage?: () => void;
  onLocatePassage?: (messageId: string, anchor: AnnotationAnchor) => void;
  focusMessageId?: string;
  focusRequest?: number;
}

export function ChatPage({
  messages,
  targetBooks,
  needsBookChoice,
  integrationError,
  onOrganize,
  onRetry,
  compact = false,
  sessionId,
  scrollPositions,
  draftPassage,
  onRemovePassage,
  onLocatePassage,
  focusMessageId,
  focusRequest,
  ...composer
}: ChatPageProps) {
  const transition = useSynthesisTransition(sessionId);
  const [choosingBook, setChoosingBook] = useState(false);
  const [organizeError, setOrganizeError] = useState("");
  const canOrganize =
    messages.some((message) => message.role === "assistant") &&
    !composer.busy &&
    !composer.pending &&
    !onRetry &&
    !integrationError &&
    !transition.busy;
  async function organize(bookId: string) {
    if (!canOrganize) return;
    try {
      setChoosingBook(false);
      setOrganizeError("");
      await transition.run(() => onOrganize(bookId));
    } catch (cause) {
      setOrganizeError(
        cause instanceof Error
          ? cause.message
          : "Could not add this conversation to the book. Your messages were kept.",
      );
    }
  }
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !sessionId) return;
    const saved = scrollPositions?.get(sessionId);
    element.scrollTop = saved ?? element.scrollHeight;
    atBottom.current =
      element.scrollHeight - element.clientHeight - element.scrollTop < 80;
    return () => {
      scrollPositions?.set(sessionId, element.scrollTop);
    };
  }, [sessionId, scrollPositions]);
  useEffect(() => {
    if (draftPassage) input.current?.focus();
  }, [draftPassage]);
  useEffect(() => {
    if (!focusMessageId) return;
    const frame = requestAnimationFrame(() => {
      content.current
        ?.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(focusMessageId)}"]`,
        )
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusMessageId, focusRequest]);

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
      ref={transition.root}
      aria-busy={transition.busy}
      className="flex h-full min-h-0 flex-1 flex-col"
      aria-label="Learning conversation"
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <ScrollArea
          className="min-h-0 flex-1"
          viewportRef={viewport}
          viewportProps={{
            onScroll: (event) => {
              const element = event.currentTarget;
              atBottom.current =
                element.scrollHeight -
                  element.clientHeight -
                  element.scrollTop <
                80;
              if (sessionId) scrollPositions?.set(sessionId, element.scrollTop);
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
            <div>
              <MessageGroup className="gap-8">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    data-message-id={message.id}
                    className="space-y-4"
                  >
                    {message.passage && (
                      <PassageQuote
                        quote={message.passage.quote}
                        annotationId={message.id}
                        onSelect={
                          onLocatePassage
                            ? () =>
                                onLocatePassage(message.id, message.passage!)
                            : undefined
                        }
                      />
                    )}
                    <AnnotationMessage {...message} />
                  </div>
                ))}
              </MessageGroup>
            </div>
            {composer.pending && (
              <p role="status" className="mt-6 text-sm text-muted-foreground">
                Thinking…
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
      <div
        className={
          compact
            ? "w-full px-4 pt-2 pb-4"
            : "mx-auto w-full max-w-2xl px-6 pt-2 pb-6"
        }
      >
        {(canOrganize || transition.busy) && (
          <div className="mb-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={transition.busy}
              onClick={() =>
                needsBookChoice
                  ? setChoosingBook(true)
                  : organize(targetBooks[0].id)
              }
            >
              <BookPlus className="size-4" />
              Synthesize into book
            </Button>
          </div>
        )}
        {(organizeError || integrationError) && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {organizeError || integrationError}
          </p>
        )}
        {draftPassage && (
          <div className="mb-3 flex items-start gap-2 px-1">
            <div className="min-w-0 flex-1">
              <PassageQuote quote={draftPassage.quote} />
            </div>
            <IconButton
              label="Remove quoted passage"
              size="icon-xs"
              onClick={onRemovePassage}
              disabled={composer.pending}
            >
              <X />
            </IconButton>
          </div>
        )}
        <QuestionInput
          {...composer}
          inputRef={input}
          busy={composer.busy || !!onRetry || transition.busy}
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
      <Dialog open={choosingBook} onOpenChange={setChoosingBook}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Synthesize into book</DialogTitle>
            <DialogDescription>
              Choose a book to weave these ideas into. Your conversation will be
              saved with the new section.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {targetBooks.map((target) => (
              <Button
                key={target.id}
                variant="ghost"
                className="h-auto w-full justify-start py-3 text-left whitespace-normal"
                onClick={() => organize(target.id)}
              >
                <BookOpen className="size-4 shrink-0" />
                {target.title}
              </Button>
            ))}
          </div>
          {organizeError && (
            <p role="alert" className="text-sm text-destructive">
              {organizeError}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
