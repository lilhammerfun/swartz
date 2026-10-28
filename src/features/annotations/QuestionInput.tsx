import { useId, useRef, useState, type Ref } from "react";
import {
  ArrowUp,
  ChevronDown,
  FileText,
  LoaderCircle,
  Plus,
  Settings2,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  modelIsConfigured,
  type ModelSettings,
} from "@/features/model/model-api";
import type { PromptAttachment } from "@/types/book";
import { promptChoices, type PromptSubmission } from "./prompt-options";
import { readPromptAttachments } from "./prompt-attachments";

// Composition and controls follow shadcn's PromptInputDemo; requests and drafts belong to the reader.
export function QuestionInput({
  value,
  onChange,
  inputRef,
  followUp = false,
  settings,
  pending,
  busy,
  error,
  onSettings,
  onSend,
  placeholder,
  label,
  attachments,
  onAttachmentsChange,
  onConfigure,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLTextAreaElement>;
  followUp?: boolean;
  placeholder?: string;
  label?: string;
  attachments?: PromptAttachment[];
  onAttachmentsChange?: (attachments: PromptAttachment[]) => void;
  onConfigure?: () => void;
  settings: ModelSettings;
  pending: boolean;
  busy: boolean;
  error?: string;
  onSettings: () => void;
  onSend: (submission: PromptSubmission) => Promise<boolean>;
}) {
  const availabilityId = useId();
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const readingFiles = useRef(false);
  const [localFiles, setLocalFiles] = useState<PromptAttachment[]>([]);
  const files = attachments ?? localFiles;
  const setFiles = (next: PromptAttachment[]) => {
    if (attachments === undefined) setLocalFiles(next);
    onAttachmentsChange?.(next);
  };
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const [selection, setSelection] = useState({
    endpoint: settings.baseUrl,
    model: settings.model,
  });
  const choices = promptChoices(settings);
  const [effort, setEffort] = useState(choices.defaultEffort as string);
  const model =
    choices.models.find(
      (item) =>
        selection.endpoint === settings.baseUrl && item.id === selection.model,
    ) ?? choices.models.find((item) => item.id === settings.model);
  const currentEffort =
    choices.efforts.find((item) => item.id === effort) ??
    choices.efforts.find((item) => item.id === choices.defaultEffort)!;
  const configured = modelIsConfigured(settings);
  const canSend =
    (configured || !!onConfigure) && !busy && !reading && !!value.trim();
  return (
    <div className="space-y-3">
      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSend) return;
          if (!configured) {
            onConfigure?.();
            return;
          }
          setFileError("");
          void onSend({
            model: model?.id === settings.model ? undefined : model?.id,
            reasoningEffort:
              currentEffort.id === "default" ? undefined : currentEffort.id,
            attachments: files,
          }).then((sent) => {
            if (sent) setFiles([]);
          });
        }}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose attachments"
          disabled={busy || reading}
          onChange={async (event) => {
            const selected = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (!selected.length || readingFiles.current) return;
            readingFiles.current = true;
            setReading(true);
            setFileError("");
            try {
              const additions = await readPromptAttachments(selected, files);
              setFiles([...files, ...additions]);
            } catch (cause) {
              setFileError(
                cause instanceof Error
                  ? cause.message
                  : "Could not read the attached file.",
              );
            } finally {
              readingFiles.current = false;
              setReading(false);
            }
          }}
        />
        <InputGroup aria-busy={pending} className="rounded-2xl border-border">
          {files.length > 0 && (
            <InputGroupAddon align="block-start" className="flex-wrap">
              {files.map((file) => (
                <Attachment key={file.id} size="sm" className="min-w-0">
                  <AttachmentMedia>
                    <FileText />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle title={file.name}>
                      {file.name}
                    </AttachmentTitle>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      disabled={busy || reading}
                      onClick={() =>
                        setFiles(files.filter((item) => item.id !== file.id))
                      }
                    >
                      <X />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              ))}
            </InputGroupAddon>
          )}
          <InputGroupTextarea
            aria-label={
              label ?? (followUp ? "Follow-up question" : "Question for AI")
            }
            aria-describedby={availabilityId}
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            placeholder={
              placeholder ??
              (followUp ? "Ask a follow-up…" : "Ask about this passage…")
            }
            className="max-h-40 min-h-16 p-3 text-sm leading-6"
            disabled={pending}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.nativeEvent.keyCode !== 229
              ) {
                event.preventDefault();
                form.current?.requestSubmit();
              }
            }}
          />
          <InputGroupAddon align="block-end" className="gap-1.5">
            <InputGroupButton
              size="icon-sm"
              variant="outline"
              className="rounded-full border-transparent"
              aria-label="Attach files"
              title="Attach text or Markdown files"
              disabled={busy || reading}
              onClick={() => fileInput.current?.click()}
            >
              {reading ? <LoaderCircle className="animate-spin" /> : <Plus />}
            </InputGroupButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton
                  size="sm"
                  variant="outline"
                  aria-label={`Model: ${model?.name ?? "Select model"}`}
                  className="ml-auto min-w-0 max-w-32 flex-1 gap-1 rounded-full border-transparent px-2 text-xs font-normal"
                  disabled={busy}
                >
                  <span className="truncate">
                    {model?.name ?? "Select model"}
                  </span>
                  <ChevronDown className="size-3" />
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52">
                <DropdownMenuLabel>
                  {choices.models.some((item) => item.id === "deepseek-flash")
                    ? "DeepSeek"
                    : "Model"}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={model?.id ?? ""}
                  onValueChange={(id) =>
                    setSelection({ endpoint: settings.baseUrl, model: id })
                  }
                >
                  {choices.models.map((item) => (
                    <DropdownMenuRadioItem key={item.id} value={item.id}>
                      {item.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                {choices.models.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={onSettings}>
                  <Settings2 />
                  Model settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton
                  size="sm"
                  variant="outline"
                  aria-label={`Effort: ${currentEffort.name}`}
                  className="gap-1 rounded-full border-transparent px-2 text-xs font-normal"
                  disabled={busy}
                >
                  <span className="text-muted-foreground">Effort</span>
                  {currentEffort.name}
                  <ChevronDown className="size-3" />
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-36">
                <DropdownMenuLabel>Effort</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={currentEffort.id}
                  onValueChange={setEffort}
                >
                  {choices.efforts.map((item) => (
                    <DropdownMenuRadioItem key={item.id} value={item.id}>
                      {item.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="outline"
              className="rounded-full"
              aria-label={pending ? "Sending question" : "Send"}
              disabled={!canSend}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ArrowUp />
              )}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <span id={availabilityId} className="sr-only">
          {configured
            ? `Model: ${model?.name}. Enter to send. Shift+Enter for a new line.`
            : "Configure a model in Settings before sending."}
        </span>
        <span role="status" className="sr-only">
          {pending ? "Thinking…" : reading ? "Reading attachments…" : ""}
        </span>
      </form>
      {(fileError || error) && (
        <Alert variant="destructive">
          <AlertDescription>{fileError || error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
