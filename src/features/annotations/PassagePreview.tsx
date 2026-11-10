import { BookOpen, X } from "@/components/ui/icons";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PassagePreview({
  quote,
  disabled,
  onRemove,
}: {
  quote: string;
  disabled: boolean;
  onRemove?: () => void;
}) {
  const characters = Array.from(quote).length.toLocaleString("en-US");
  return (
    <Dialog>
      <Attachment size="sm" className="w-56 min-w-0 flex-nowrap items-center">
        <AttachmentMedia>
          <BookOpen />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>Quoted passage</AttachmentTitle>
          <AttachmentDescription>{characters} characters</AttachmentDescription>
        </AttachmentContent>
        <DialogTrigger asChild>
          <AttachmentTrigger
            aria-label={`View quoted passage, ${characters} characters`}
          />
        </DialogTrigger>
        {onRemove && (
          <AttachmentActions className="pr-1">
            <AttachmentAction
              aria-label="Remove quoted passage"
              disabled={disabled}
              onClick={onRemove}
            >
              <X />
            </AttachmentAction>
          </AttachmentActions>
        )}
      </Attachment>
      <DialogContent style={{ maxWidth: "min(42rem, calc(100vw - 2rem))" }}>
        <DialogHeader className="pr-6">
          <DialogTitle>Quoted passage</DialogTitle>
          <DialogDescription>{characters} characters</DialogDescription>
        </DialogHeader>
        <ScrollArea
          className="h-[min(60dvh,28rem)] min-w-0"
          viewportProps={{
            tabIndex: 0,
            "aria-label": "Quoted passage content",
          }}
        >
          <blockquote className="pr-4 text-sm leading-7 wrap-anywhere whitespace-pre-wrap select-text">
            {quote}
          </blockquote>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
