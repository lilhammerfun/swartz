import { Button } from "@/components/ui/button";
import { MessageCirclePlus } from "@/components/ui/icons";
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
import type { ChatSession } from "./chat-store";
import type { ReaderLocation } from "@/types/book";

/** Home navigation follows saved conversations; project navigation lives in Library. */
export function ConversationSidebar({
  sessions,
  location,
  pendingSessionId,
  onNavigate,
}: {
  sessions: readonly ChatSession[];
  location: ReaderLocation;
  pendingSessionId?: string;
  onNavigate: (location: ReaderLocation) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const conversations = sessions
    .filter((session) => !session.bookId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const navigate = (next: ReaderLocation) => {
    onNavigate(next);
    if (isMobile) setOpenMobile(false);
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
          <SidebarGroup className="conversation-history-group">
            <SidebarGroupLabel className="sidebar-section-label">
              Your chats
            </SidebarGroupLabel>
            <SidebarMenu>
              {conversations.map((session) => (
                <SidebarMenuItem key={session.id}>
                  <Button
                    variant="navigation"
                    size="navigation"
                    className="conversation-history-item"
                    aria-current={
                      location.scale === "chat" &&
                      location.conversationId === session.id
                        ? "page"
                        : undefined
                    }
                    onClick={() =>
                      navigate({ scale: "chat", conversationId: session.id })
                    }
                  >
                    <span className="conversation-history-title">
                      {session.title}
                    </span>
                    {pendingSessionId === session.id && (
                      <span
                        className="conversation-history-pending"
                        role="status"
                        aria-label="Responding"
                      />
                    )}
                  </Button>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            {!conversations.length && (
              <p className="sidebar-empty">
                Your conversations will appear here.
              </p>
            )}
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
