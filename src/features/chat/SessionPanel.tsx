import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PassageQuote } from "@/features/annotations/PassageQuote";
import type { ChatSession } from "./chat-store";

export function SessionPanel({
  session,
  drafts,
  unanswered,
  renderSession,
  onSelect,
  toolbar,
}: {
  session?: ChatSession;
  drafts: ChatSession[];
  unanswered: ChatSession[];
  renderSession: (session: ChatSession) => ReactNode;
  onSelect: (id: string) => void;
  toolbar: HTMLDivElement | null;
}) {
  const [showDrafts, setShowDrafts] = useState(false);
  return (
    <aside
      id="session-panel"
      className="session-panel"
      aria-label="Project conversation"
    >
      {toolbar &&
        createPortal(
          <div className="conversation-toolbar">
            <span>Conversation</span>
            {!!drafts.length && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDrafts(true)}
              >
                Saved drafts{" "}
                <span className="text-muted-foreground">{drafts.length}</span>
              </Button>
            )}
          </div>,
          toolbar,
        )}
      {unanswered.map((record) => (
        <div key={record.id} className="conversation-recovery" role="status">
          <span>An earlier response needs attention.</span>
          <Button variant="ghost" size="sm" onClick={() => onSelect(record.id)}>
            Review
          </Button>
        </div>
      ))}
      {session && renderSession(session)}
      <Dialog open={showDrafts} onOpenChange={setShowDrafts}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Saved drafts</DialogTitle>
            <DialogDescription>
              Unsent work from your earlier conversations. Select a draft to
              continue it in this project.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-2">
              {drafts.map((draft) => (
                <Button
                  key={draft.id}
                  variant="ghost"
                  className="draft-option"
                  onClick={() => {
                    onSelect(draft.id);
                    setShowDrafts(false);
                  }}
                >
                  <span className="line-clamp-3 whitespace-pre-wrap">
                    {draft.draft ||
                      (draft.draftAttachments.length
                        ? draft.draftAttachments
                            .map((file) => file.name)
                            .join(", ")
                        : "Quoted passage")}
                  </span>
                  {draft.draftPassage && (
                    <PassageQuote quote={draft.draftPassage.quote} />
                  )}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
