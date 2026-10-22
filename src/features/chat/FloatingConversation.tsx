import { useEffect, useRef, type ReactNode } from "react";
import { MessagesSquare, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { IconButton } from "@/components/ui/IconButton";

interface FloatingConversationProps {
  open: boolean;
  bookTitle: string;
  hasMessages: boolean;
  annotationsOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function FloatingConversation({
  open,
  bookTitle,
  hasMessages,
  annotationsOpen = false,
  onOpenChange,
  children,
}: FloatingConversationProps) {
  const launcher = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) launcher.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={`book-conversation fixed right-6 bottom-6 z-40 max-w-[calc(100vw-32px)] max-sm:right-4 max-sm:bottom-4 ${annotationsOpen ? "annotations-visible" : ""}`}
    >
      <CollapsibleContent>
        <Card
          role="region"
          aria-label="Book conversation"
          className={`${hasMessages ? "h-[min(600px,calc(100dvh-48px))]" : "h-[min(420px,calc(100dvh-48px))]"} w-[440px] max-w-[calc(100vw-32px)] gap-0 py-0 shadow-xl`}
        >
          <CardHeader className="items-center px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessagesSquare className="size-4 text-muted-foreground" />
              Discuss this book
            </CardTitle>
            <CardDescription
              className="min-w-0 truncate text-xs"
              title={bookTitle}
            >
              {bookTitle}
            </CardDescription>
            <CardAction className="self-center">
              <CollapsibleTrigger asChild>
                <IconButton label="Minimize conversation">
                  <Minus />
                </IconButton>
              </CollapsibleTrigger>
            </CardAction>
          </CardHeader>
          <div className="min-h-0 flex-1">{children}</div>
        </Card>
      </CollapsibleContent>
      {!open && (
        <CollapsibleTrigger asChild>
          <Button
            ref={launcher}
            variant="outline"
            className="h-11 gap-2 rounded-full bg-background px-4 shadow-lg"
          >
            <MessagesSquare className="size-4" />A thought…
          </Button>
        </CollapsibleTrigger>
      )}
    </Collapsible>
  );
}
