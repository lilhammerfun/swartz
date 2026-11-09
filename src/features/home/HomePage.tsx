import { useEffect, useRef } from "react";
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
  onCancel?: () => void;
  attachments?: PromptAttachment[];
  onAttachmentsChange?: (attachments: PromptAttachment[]) => void;
}

export function HomePage(composer: HomeComposerProps) {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <ScrollArea className="h-full min-h-0 flex-1">
      <section className="home-page" aria-label="New conversation">
        <header className="home-heading">
          <h1 className="home-title">What’s on your mind?</h1>
        </header>
        <QuestionInput
          {...composer}
          inputRef={input}
          label="Start a conversation"
          placeholder="Ask anything…"
        />
      </section>
    </ScrollArea>
  );
}
