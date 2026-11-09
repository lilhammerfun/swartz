import { FileText } from "@/components/ui/icons";
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
            <img src="/logo.svg" alt="" className="size-4 sidebar-brand-mark" />
          )}
          {question && <span>Question</span>}
          {createdAt && (
            <time className="text-micro font-normal" dateTime={createdAt}>
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
              }).format(new Date(createdAt))}
            </time>
          )}
        </MessageHeader>
        <Bubble
          variant={question ? "tinted" : "ghost"}
          align={question ? "end" : "start"}
          className={question ? "max-w-full" : "w-full max-w-full"}
        >
          <BubbleContent
            className={question ? "space-y-3 px-4 py-3" : "w-full space-y-3"}
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
