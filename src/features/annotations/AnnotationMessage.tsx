import { FileText, Sparkles } from "lucide-react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import {
  Attachment,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { MarkdownBlock } from "@/features/reader/MarkdownBlock";
import type { PromptAttachment } from "@/types/book";

export function AnnotationMessage({
  role,
  text,
  attachments = [],
  createdAt,
}: {
  role: "user" | "assistant";
  text: string;
  attachments?: PromptAttachment[];
  createdAt?: string;
}) {
  const question = role === "user";
  return (
    <Message
      align={question ? "end" : "start"}
      role="group"
      aria-label={question ? "Question" : "AI answer"}
    >
      <MessageContent className={question ? "max-w-[92%] gap-2" : "gap-2.5"}>
        <MessageHeader
          className={`gap-2 px-0 ${question ? "justify-end" : ""}`}
        >
          {!question && (
            <Sparkles aria-hidden="true" className="size-3.5 text-[#9473ac]" />
          )}
          <span className="font-medium text-foreground">
            {question ? "Question" : "AI answer"}
          </span>
          {createdAt && (
            <time className="text-[11px] font-normal" dateTime={createdAt}>
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
              }).format(new Date(createdAt))}
            </time>
          )}
        </MessageHeader>
        <Bubble
          variant={question ? "muted" : "ghost"}
          align={question ? "end" : "start"}
          className={question ? "max-w-full" : "w-full max-w-full"}
        >
          <BubbleContent
            className={
              question
                ? "space-y-3 rounded-2xl rounded-tr-sm px-3.5 py-2.5"
                : "w-full space-y-3"
            }
          >
            <div className="discussion-markdown text-sm leading-6">
              <MarkdownBlock
                source={text}
                highlights={[]}
                activeId={null}
                onSelectAnnotation={() => {}}
              />
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Attached files">
                {attachments.map((file) => (
                  <Attachment key={file.id} size="sm" className="min-w-0">
                    <AttachmentMedia>
                      <FileText />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle title={file.name}>
                        {file.name}
                      </AttachmentTitle>
                    </AttachmentContent>
                  </Attachment>
                ))}
              </div>
            )}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
