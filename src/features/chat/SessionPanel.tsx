import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, List, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconButton } from "@/components/ui/IconButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { PassageQuote } from "@/features/annotations/PassageQuote";
import type { ChatSession } from "./chat-store";
import type { SessionPanelState } from "./useSessionPanel";

interface SessionPanelProps {
  state: SessionPanelState;
  sessions: ChatSession[];
  renderSession: (session: ChatSession) => ReactNode;
  onSelect: (id: string) => void;
  onList: () => void;
  onCloseTab: (id: string) => void;
  onNew: () => void;
  onClearPassage: () => void;
  error?: string;
  toolbar: HTMLDivElement | null;
}

export function SessionPanel({
  state,
  sessions,
  renderSession,
  onSelect,
  onList,
  onCloseTab,
  onNew,
  onClearPassage,
  error,
  toolbar,
}: SessionPanelProps) {
  const strip = useRef<HTMLDivElement>(null);
  const opened = state.tabs.flatMap(
    (id) => sessions.find((session) => session.id === id) ?? [],
  );
  const active = opened.some((session) => session.id === state.active)
    ? state.active
    : "list";
  const listed = state.passageMessageIds
    ? sessions.filter((session) =>
        session.messages.some((message) =>
          state.passageMessageIds!.includes(message.id),
        ),
      )
    : sessions;
  return (
    <aside id="session-panel" className="session-panel" aria-label="Sessions">
      <Tabs
        value={active}
        onValueChange={(id) => (id === "list" ? onList() : onSelect(id))}
        className="h-full min-h-0 gap-0"
      >
        {toolbar &&
          createPortal(
            <div className="flex h-full min-w-0 flex-1 items-center gap-1">
              <div
                ref={strip}
                className="session-tab-strip flex min-w-0 flex-1 items-center"
              >
                <TabsList
                  variant="line"
                  aria-label="Session tabs"
                  className="session-tabs h-10 min-w-0 flex-1 justify-start gap-0 p-0"
                >
                  <TabsTrigger
                    value="list"
                    aria-label="Session list"
                    title="Session list"
                    className="session-tab px-2.5"
                  >
                    <List className="size-4" />
                  </TabsTrigger>
                  {opened.map((session) => (
                    <div
                      key={session.id}
                      className="session-tab-group"
                      data-selected={active === session.id}
                    >
                      <TabsTrigger
                        value={session.id}
                        data-session-id={session.id}
                        className="session-tab session-tab-title"
                        title={session.title}
                      >
                        <span className="truncate">{session.title}</span>
                      </TabsTrigger>
                      <IconButton
                        label={`Close ${session.title}`}
                        size="icon-xs"
                        className="session-tab-close"
                        onClick={() => {
                          onCloseTab(session.id);
                          requestAnimationFrame(() =>
                            strip.current
                              ?.querySelector<HTMLElement>(
                                '[data-state="active"]',
                              )
                              ?.focus({ preventScroll: true }),
                          );
                        }}
                      >
                        <X className="size-3" />
                      </IconButton>
                    </div>
                  ))}
                </TabsList>
              </div>
              <IconButton label="New session" onClick={onNew}>
                <Plus />
              </IconButton>
            </div>,
            toolbar,
          )}
        <TabsContent value="list" className="min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-3 py-3">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {state.pendingPassage && (
                <div className="mb-5 space-y-3 rounded-lg bg-muted/40 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <PassageQuote quote={state.pendingPassage.quote} />
                    </div>
                    <IconButton
                      label="Remove pending passage"
                      size="icon-xs"
                      onClick={onClearPassage}
                    >
                      <X />
                    </IconButton>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Open or start a session to use this passage.
                  </p>
                </div>
              )}
              {state.passageMessageIds && (
                <div className="mb-2 flex min-h-7 items-center justify-between px-3">
                  <h2 className="text-[13px] font-medium text-foreground/80">
                    Sessions on this passage
                  </h2>
                  <Button size="xs" variant="ghost" onClick={onList}>
                    Show all
                  </Button>
                </div>
              )}
              <ItemGroup className="gap-1">
                {listed.map((session) => {
                  const preview = (
                    session.draft ||
                    session.messages.at(-1)?.text ||
                    ""
                  )
                    .replace(/(\*\*|__|`)(.*?)\1/g, "$2")
                    .replace(/\s+/g, " ")
                    .trim();
                  return (
                    <div key={session.id} role="listitem">
                      <Item
                        asChild
                        size="sm"
                        className="session-list-item flex-nowrap"
                      >
                        <Button
                          variant="ghost"
                          aria-label={session.title}
                          aria-describedby={
                            preview
                              ? `session-preview-${session.id}`
                              : undefined
                          }
                          className="h-auto w-full items-start justify-start gap-3 px-3 py-2.5 text-left font-normal whitespace-normal transition-colors focus-visible:ring-2 focus-visible:ring-inset"
                          onClick={() => onSelect(session.id)}
                        >
                          <ItemContent className="min-w-0 gap-0">
                            <ItemTitle className="block w-full truncate text-[13px] leading-5">
                              {session.title}
                            </ItemTitle>
                            {preview && (
                              <ItemDescription
                                id={`session-preview-${session.id}`}
                                className="mt-0.5 text-xs leading-5 text-muted-foreground/85"
                              >
                                {preview}
                              </ItemDescription>
                            )}
                          </ItemContent>
                          <ItemActions className="self-center">
                            {session.request?.status === "pending" ? (
                              <span className="text-xs text-muted-foreground">
                                Thinking…
                              </span>
                            ) : (
                              <ChevronRight
                                aria-hidden="true"
                                className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
                              />
                            )}
                          </ItemActions>
                        </Button>
                      </Item>
                    </div>
                  );
                })}
              </ItemGroup>
              {!listed.length && (
                <p className="px-2 py-8 text-sm text-muted-foreground">
                  Start a session to explore this book.
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        {opened.map((session) => (
          <TabsContent
            key={session.id}
            value={session.id}
            className="min-h-0 overflow-hidden"
          >
            {renderSession(session)}
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  );
}
