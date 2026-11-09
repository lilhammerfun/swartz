import { useEffect, useLayoutEffect, useRef } from "react";
import { X } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/button";
import { MessageGroup } from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnnotationMessage } from "@/features/annotations/AnnotationMessage";
import { QuestionInput } from "@/features/annotations/QuestionInput";
import { PassageQuote } from "@/features/annotations/PassageQuote";
import type { HomeComposerProps } from "@/features/home/HomePage";
import type { AnnotationAnchor, PromptAttachment } from "@/types/book";

export interface ChatViewMessage {
  id: string;
  sourceSessionId?: string;
  role: "user" | "assistant";
  text: string;
  attachments?: PromptAttachment[];
  createdAt?: string;
  passage?: AnnotationAnchor;
}
export interface ChatPageProps extends HomeComposerProps {
  compact?: boolean;
  messages: ChatViewMessage[];
  onRetry?: () => void;
  onStartLearning?: () => void;
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
  onRetry,
  onStartLearning,
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
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !sessionId) return;
    element.scrollTop = scrollPositions?.get(sessionId) ?? element.scrollHeight;
    atBottom.current =
      element.scrollHeight - element.clientHeight - element.scrollTop < 80;
    return () => {
      scrollPositions?.set(sessionId, element.scrollTop);
    };
  }, [sessionId, scrollPositions]);
  useEffect(() => {
    if (draftPassage && !focusMessageId) input.current?.focus();
  }, [draftPassage, focusMessageId]);
  useEffect(() => {
    if (!focusMessageId) return;
    atBottom.current = false;
    const frame = requestAnimationFrame(() => {
      const message = content.current?.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(focusMessageId)}"]`,
      );
      message?.focus({ preventScroll: true });
      message?.scrollIntoView({ block: "center" });
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
      className="conversation-view"
      data-compact={compact}
      aria-label="Learning conversation"
    >
      <ScrollArea
        className="conversation-scroll"
        viewportRef={viewport}
        viewportProps={{
          onScroll: (event) => {
            const element = event.currentTarget;
            atBottom.current =
              element.scrollHeight - element.clientHeight - element.scrollTop <
              80;
            if (sessionId) scrollPositions?.set(sessionId, element.scrollTop);
          },
        }}
      >
        <div ref={content} className="conversation-content">
          {!messages.length && !composer.pending && (
            <div className="conversation-empty">
              <h2>
                {onStartLearning ? "Where shall we begin?" : "Keep exploring."}
              </h2>
              <p>
                {onStartLearning
                  ? "Ask a question, bring a passage, or let your Tutor suggest a starting point."
                  : "Your questions and ideas belong here."}
              </p>
              {onStartLearning && (
                <Button
                  variant="outline"
                  onClick={onStartLearning}
                  disabled={composer.busy || !!onRetry}
                >
                  Start learning
                </Button>
              )}
            </div>
          )}
          <MessageGroup className="gap-8">
            {messages.map((message) => (
              <div
                key={`${message.sourceSessionId ?? sessionId}:${message.id}`}
                data-message-id={message.id}
                data-focused={focusMessageId === message.id}
                tabIndex={-1}
                className="conversation-exchange"
              >
                {message.passage && (
                  <PassageQuote
                    quote={message.passage.quote}
                    annotationId={message.id}
                    onSelect={
                      onLocatePassage
                        ? () => onLocatePassage(message.id, message.passage!)
                        : undefined
                    }
                  />
                )}
                <AnnotationMessage {...message} />
              </div>
            ))}
          </MessageGroup>
          {composer.pending && (
            <p role="status" className="conversation-pending">
              <span className="thinking-indicator" />
              Thinking…
            </p>
          )}
        </div>
      </ScrollArea>
      <div className="conversation-composer">
        {draftPassage && (
          <div className="conversation-draft-quote">
            <PassageQuote quote={draftPassage.quote} />
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
          onSend={(submission) => {
            atBottom.current = true;
            return composer.onSend(submission);
          }}
          inputRef={input}
          busy={composer.busy || !!onRetry}
          label="Message AI"
          placeholder={
            messages.length
              ? "Ask a follow-up…"
              : "Ask anything about this project…"
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
