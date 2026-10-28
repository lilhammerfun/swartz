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

export function HomePage(composer: HomeComposerProps) {
  return (
    <ScrollArea className="h-full min-h-0 flex-1">
      <section
        className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-2xl flex-col justify-center px-6 pt-12 pb-[clamp(64px,18vh,160px)]"
        aria-label="Start learning"
      >
        <header className="mb-7 text-center">
          <h1 className="text-2xl leading-tight font-normal">
            What’s on your mind?
          </h1>
        </header>
        <QuestionInput
          {...composer}
          label="Start a conversation"
          placeholder="Ask a question or describe what you want to explore…"
        />
      </section>
    </ScrollArea>
  );
}
