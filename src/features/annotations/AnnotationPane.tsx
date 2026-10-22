import { useEffect, useRef } from "react";
import { ArrowLeft, ChevronRight, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconButton } from "@/components/ui/IconButton";
import { QuestionInput } from "./QuestionInput";
import { AnnotationMessage } from "./AnnotationMessage";
import { PassageQuote } from "./PassageQuote";
import { annotationColorStyle } from "./annotation-colors";
import type { AnnotationSelection } from "./annotation-selection";
import type { ModelSettings } from "@/features/model/model-api";
import type { PromptSubmission } from "./prompt-options";
import type {
  Annotation,
  AnnotationAnchor,
  PromptAttachment,
} from "@/types/book";

export interface QuestionComposer {
  anchor: AnnotationAnchor;
}
export interface DiscussionDraft {
  text: string;
  attachments: PromptAttachment[];
}
interface AnnotationPaneProps {
  open: boolean;
  scope: string;
  annotations: Annotation[];
  selectedId: string | null;
  selection: AnnotationSelection | null;
  composer: QuestionComposer | null;
  draft: string;
  attachments: PromptAttachment[];
  onDraft: (text: string) => void;
  onAttachments: (attachments: PromptAttachment[]) => void;
  discussionDrafts: Record<string, DiscussionDraft>;
  onDiscussionDraft: (id: string, update: Partial<DiscussionDraft>) => void;
  scrollPositions: Map<string, number>;
  onCancel: () => void;
  onBack: () => void;
  onAll: () => void;
  onPreview: (id: string | null) => void;
  onSelect: (annotation: Annotation) => void;
  onLocate: (annotation: Annotation) => void;
  settings: ModelSettings;
  onSettings: () => void;
  pendingId: string | null;
  requestError: { id: string; message: string } | null;
  onAsk: (submission: PromptSubmission) => Promise<boolean>;
  onFollowUp: (
    annotation: Annotation,
    question: string,
    submission: PromptSubmission,
  ) => Promise<boolean>;
}

export function AnnotationPane({
  open,
  scope,
  annotations,
  selectedId,
  selection,
  composer,
  draft,
  attachments,
  onDraft,
  onAttachments,
  discussionDrafts,
  onDiscussionDraft,
  scrollPositions,
  onCancel,
  onBack,
  onAll,
  onPreview,
  onSelect,
  onLocate,
  settings,
  onSettings,
  pendingId,
  requestError,
  onAsk,
  onFollowUp,
}: AnnotationPaneProps) {
  const input = useRef<HTMLTextAreaElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const previousDiscussion = useRef<string | null>(null);
  const selected = composer
    ? undefined
    : annotations.find((note) => note.id === selectedId);
  const shown = selection
    ? annotations.filter((note) => selection.ids.includes(note.id))
    : annotations;
  const browseKey = selection
    ? `selection:${selection.ids.join(",")}:${selection.passage}`
    : "list";
  const viewKey = `${scope}:${composer ? "new" : selected ? `discussion:${selected.id}` : browseKey}`;
  const selectedRef = useRef(selected?.id);
  selectedRef.current = selected?.id;
  const visibleRef = useRef(open);
  visibleRef.current = open;
  const discussionDraft = selected ? discussionDrafts[selected.id] : undefined;

  useEffect(() => {
    if (!open) return;
    const scroll = viewport.current;
    if (scroll) scroll.scrollTop = scrollPositions.get(viewKey) ?? 0;
    if (composer) input.current?.focus({ preventScroll: true });
    else if (selected) back.current?.focus({ preventScroll: true });
    else if (previousDiscussion.current) {
      const row = scroll?.querySelector<HTMLButtonElement>(
        `[data-annotation-id="${CSS.escape(previousDiscussion.current)}"]`,
      );
      (row ?? back.current ?? heading.current)?.focus({ preventScroll: true });
    }
    previousDiscussion.current = selected?.id ?? null;
  }, [viewKey, open, scrollPositions]);

  const scrollToReply = (id: string) => {
    requestAnimationFrame(() => {
      if (visibleRef.current && selectedRef.current === id) {
        const scroll = viewport.current;
        scroll?.scrollTo({ top: scroll.scrollHeight, left: 0 });
      }
    });
  };

  return (
    <aside
      id="annotation-panel"
      hidden={!open}
      className="annotation-pane flex flex-col"
      aria-label="Annotations and AI discussions"
    >
      <header className="annotation-pane-heading">
        {composer ? (
          <>
            <h2 className="text-[13px] font-medium">Ask AI</h2>
            <IconButton
              label="Discard question"
              size="icon-xs"
              onClick={onCancel}
              disabled={pendingId === "new"}
              className="ml-auto"
            >
              <X />
            </IconButton>
          </>
        ) : selected || selection ? (
          <>
            <Button
              ref={back}
              variant="ghost"
              size="sm"
              className="annotation-back"
              onClick={selected ? onBack : onAll}
            >
              <ArrowLeft className="size-4" />
              {selected && selection
                ? `${shown.length} questions`
                : "All annotations"}
            </Button>
            {selected && (
              <span className="annotation-view-label">Discussion</span>
            )}
          </>
        ) : (
          <>
            <h2
              ref={heading}
              tabIndex={-1}
              className="text-[13px] font-medium outline-none"
            >
              Annotations
            </h2>
            {annotations.length > 0 && (
              <Badge
                variant="secondary"
                className="rounded-sm px-1.5 text-[10px] font-normal tabular-nums"
              >
                {annotations.length}
              </Badge>
            )}
          </>
        )}
      </header>

      {!composer && !selected && selection && (
        <div className="annotation-selection-context">
          <h3>
            {shown.length} questions on this {selection.scope}
          </h3>
          <p>“{selection.passage}”</p>
        </div>
      )}

      <ScrollArea
        key={viewKey}
        className="annotation-content-scroll min-h-0 flex-1"
        viewportRef={viewport}
        viewportProps={{
          tabIndex: 0,
          "aria-label": composer
            ? "Selected passage"
            : selected
              ? "Discussion messages"
              : selection
                ? "Questions on selected text"
                : "Annotation list",
          onScroll: (event) => {
            if (open)
              scrollPositions.set(viewKey, event.currentTarget.scrollTop);
          },
        }}
      >
        {composer ? (
          <div className="annotation-discussion-content">
            <PassageQuote quote={composer.anchor.quote} />
          </div>
        ) : selected ? (
          <div
            className="annotation-discussion-content"
            data-annotation-id={selected.id}
          >
            <PassageQuote
              quote={selected.anchor.quote}
              annotationId={selected.id}
              onSelect={() => onLocate(selected)}
            />
            <div className="annotation-discussion-messages">
              <AnnotationMessage
                role="user"
                text={selected.text}
                attachments={selected.attachments}
                createdAt={selected.createdAt}
              />
              {selected.messages.map((message) => (
                <AnnotationMessage
                  key={message.id}
                  role={message.role}
                  text={message.text}
                  attachments={message.attachments}
                />
              ))}
            </div>
          </div>
        ) : shown.length > 0 ? (
          <ul className="annotation-question-list">
            {shown.map((note) => (
              <li key={note.id}>
                <Button
                  variant="ghost"
                  className="annotation-question-row"
                  data-annotation-id={note.id}
                  style={annotationColorStyle(note.id)}
                  onPointerEnter={() => onPreview(note.id)}
                  onPointerLeave={() => onPreview(null)}
                  onFocus={() => onPreview(note.id)}
                  onBlur={() => onPreview(null)}
                  onClick={() => onSelect(note)}
                  aria-label={note.text}
                >
                  <span className="annotation-color-dot" aria-hidden="true" />
                  <span className="annotation-question-content">
                    <span className="annotation-question-title">
                      {note.text}
                    </span>
                    <span className="annotation-question-quote">
                      {note.anchor.quote}
                    </span>
                  </span>
                  <ChevronRight
                    className="annotation-question-chevron size-3.5"
                    aria-hidden="true"
                  />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-4 px-6 py-16">
            <MessageSquare className="size-5 text-muted-foreground/40" />
            <p className="text-center text-xs leading-6 text-muted-foreground">
              Select a passage to ask AI.
            </p>
          </div>
        )}
      </ScrollArea>

      {(composer || selected) && (
        <footer
          className="annotation-composer"
          aria-label={composer ? "Question composer" : "Follow-up composer"}
        >
          {composer ? (
            <QuestionInput
              key="new"
              value={draft}
              onChange={onDraft}
              attachments={attachments}
              onAttachmentsChange={onAttachments}
              inputRef={input}
              settings={settings}
              onSettings={onSettings}
              pending={pendingId === "new"}
              busy={pendingId !== null}
              error={
                requestError?.id === "new" ? requestError.message : undefined
              }
              onSend={onAsk}
            />
          ) : (
            selected && (
              <QuestionInput
                key={selected.id}
                value={discussionDraft?.text ?? ""}
                onChange={(text) => onDiscussionDraft(selected.id, { text })}
                attachments={discussionDraft?.attachments ?? []}
                onAttachmentsChange={(files) =>
                  onDiscussionDraft(selected.id, { attachments: files })
                }
                followUp
                settings={settings}
                onSettings={onSettings}
                pending={pendingId === selected.id}
                busy={pendingId !== null}
                error={
                  requestError?.id === selected.id
                    ? requestError.message
                    : undefined
                }
                onSend={async (submission) => {
                  const sent = await onFollowUp(
                    selected,
                    discussionDraft?.text ?? "",
                    submission,
                  );
                  if (sent) {
                    onDiscussionDraft(selected.id, {
                      text: "",
                      attachments: [],
                    });
                    scrollToReply(selected.id);
                  }
                  return sent;
                }}
              />
            )
          )}
        </footer>
      )}
    </aside>
  );
}
