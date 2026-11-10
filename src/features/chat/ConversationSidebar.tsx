import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/IconButton";
import {
  Folder,
  FolderOpen,
  MessageCirclePlus,
  Plus,
} from "@/components/ui/icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Project } from "@/features/projects/project-data";
import type { ChatSession } from "./chat-store";
import type { ReaderLocation } from "@/types/book";

function ConversationItem({
  session,
  selected,
  pending,
  onSelect,
}: {
  session: ChatSession;
  selected: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  return (
    <SidebarMenuItem>
      <Button
        variant="navigation"
        size="navigation"
        className="conversation-history-item"
        aria-current={selected ? "page" : undefined}
        onClick={onSelect}
      >
        <span className="conversation-history-title">{session.title}</span>
        {!pending && session.request && (
          <span className="text-xs text-muted-foreground">Retry</span>
        )}
        {pending && (
          <span
            className="conversation-history-pending"
            role="status"
            aria-label="Responding"
          />
        )}
      </Button>
    </SidebarMenuItem>
  );
}

function ProjectConversations({
  project,
  sessions,
  selectedId,
  pendingSessionId,
  onSelect,
  onNewChat,
}: {
  project: Project;
  sessions: ChatSession[];
  selectedId?: string;
  pendingSessionId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  const active = sessions.some((session) => session.id === selectedId);
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <div
          data-slot="conversation-project-row"
          className="conversation-project-row navigation-control"
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="navigation"
              size="navigation"
              className="conversation-project-toggle"
            >
              {open ? <FolderOpen /> : <Folder />}
              <span className="conversation-history-title">
                {project.title}
              </span>
            </Button>
          </CollapsibleTrigger>
          <IconButton
            label={`New chat in ${project.title}`}
            className="conversation-project-action"
            size="icon-xs"
            onClick={() => {
              setOpen(true);
              onNewChat();
            }}
          >
            <Plus />
          </IconButton>
        </div>
        <CollapsibleContent>
          <SidebarMenu className="conversation-project-sessions">
            {sessions.map((session) => (
              <ConversationItem
                key={session.id}
                session={session}
                selected={session.id === selectedId}
                pending={session.id === pendingSessionId}
                onSelect={() => onSelect(session.id)}
              />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function ConversationSidebar({
  projects,
  sessions,
  location,
  pendingSessionId,
  onNavigate,
  onNewProjectChat,
}: {
  projects: readonly Project[];
  sessions: readonly ChatSession[];
  location: ReaderLocation;
  pendingSessionId?: string;
  onNavigate: (location: ReaderLocation) => void;
  onNewProjectChat: (project: Project) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const ordered = [...sessions].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  const grouped = projects
    .map((project) => ({
      project,
      sessions: ordered.filter((session) => session.bookId === project.id),
    }))
    .filter((group) => group.sessions.length > 0)
    .sort(
      (a, b) =>
        Date.parse(b.sessions[0].updatedAt) -
        Date.parse(a.sessions[0].updatedAt),
    );
  const ungrouped = ordered.filter(
    (session) =>
      !session.bookId ||
      !projects.some((project) => project.id === session.bookId),
  );
  const selectedId =
    location.scale === "chat" ? location.conversationId : undefined;
  const close = () => {
    if (isMobile) setOpenMobile(false);
  };
  const navigate = (next: ReaderLocation) => {
    onNavigate(next);
    close();
  };
  return (
    <Sidebar
      collapsible="offcanvas"
      className="conversation-sidebar"
      aria-label="Conversation navigation"
    >
      <SidebarHeader className="secondary-navigation-header">
        <span>Chats</span>
      </SidebarHeader>
      <div className="conversation-sidebar-operations">
        <Button
          variant="navigation"
          size="navigation"
          onClick={() => navigate({ scale: "home" })}
        >
          <MessageCirclePlus />
          <span>New chat</span>
        </Button>
      </div>
      <SidebarContent className="conversation-sidebar-body">
        <ScrollArea className="conversation-history-scroll">
          {grouped.length > 0 && (
            <SidebarGroup className="conversation-history-group">
              <SidebarGroupLabel className="sidebar-section-label">
                Projects
              </SidebarGroupLabel>
              <SidebarMenu>
                {grouped.map(({ project, sessions }) => (
                  <ProjectConversations
                    key={project.id}
                    project={project}
                    sessions={sessions}
                    selectedId={selectedId}
                    pendingSessionId={pendingSessionId}
                    onSelect={(id) =>
                      navigate({ scale: "chat", conversationId: id })
                    }
                    onNewChat={() => {
                      onNewProjectChat(project);
                      close();
                    }}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )}
          {(ungrouped.length > 0 || grouped.length === 0) && (
            <SidebarGroup className="conversation-history-group">
              <SidebarGroupLabel className="sidebar-section-label">
                Other chats
              </SidebarGroupLabel>
              <SidebarMenu>
                {ungrouped.map((session) => (
                  <ConversationItem
                    key={session.id}
                    session={session}
                    selected={session.id === selectedId}
                    pending={session.id === pendingSessionId}
                    onSelect={() =>
                      navigate({ scale: "chat", conversationId: session.id })
                    }
                  />
                ))}
              </SidebarMenu>
              {ungrouped.length === 0 && (
                <p className="sidebar-empty">
                  Your conversations will appear here.
                </p>
              )}
            </SidebarGroup>
          )}
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
