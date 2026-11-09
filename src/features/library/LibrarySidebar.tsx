import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronRight,
  FolderOpen,
  LayoutDashboard,
} from "@/components/ui/icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Project } from "@/features/projects/project-data";
import type { LearningBook, ReaderLocation } from "@/types/book";

export function LibrarySidebar({
  book,
  location,
  onNavigate,
  showContents = true,
  projects,
  gettingStarted,
}: {
  book?: LearningBook;
  location: ReaderLocation;
  onNavigate: (location: ReaderLocation) => void;
  showContents?: boolean;
  projects: readonly Project[];
  gettingStarted?: ReactNode;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const { isMobile, setOpenMobile } = useSidebar();
  const projectTitle =
    projects.find((project) => project.id === book?.id)?.title ?? book?.title;
  const activeChapterId =
    location.scale === "section" ? location.chapterId : undefined;
  useEffect(() => {
    if (activeChapterId)
      setExpanded((ids) =>
        ids.includes(activeChapterId) ? ids : [...ids, activeChapterId],
      );
  }, [book?.id, activeChapterId]);
  const navigate = (next: ReaderLocation) => {
    onNavigate(next);
    if (isMobile) setOpenMobile(false);
  };
  return (
    <Sidebar
      collapsible="offcanvas"
      className="book-sidebar"
      aria-label="Library navigation"
    >
      <SidebarHeader className="secondary-navigation-header">
        <span
          className="truncate"
          title={showContents && book ? projectTitle : undefined}
        >
          {showContents && book
            ? projectTitle
            : location.scale === "settings"
              ? "Settings"
              : "Workspace"}
        </span>
      </SidebarHeader>
      <SidebarContent className="sidebar-navigation">
        {!showContents && (
          <>
            <SidebarGroup className="p-0" aria-label="Projects">
              <SidebarGroupLabel className="sidebar-section-label">
                Projects
              </SidebarGroupLabel>
              <SidebarMenu>
                {projects.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      className="sidebar-nav-button"
                      onClick={() =>
                        navigate({ scale: "project", projectId: project.id })
                      }
                    >
                      <FolderOpen />
                      <span>{project.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              {!projects.length && (
                <p className="sidebar-empty">Your projects will appear here.</p>
              )}
            </SidebarGroup>
          </>
        )}
        {showContents && book && (
          <SidebarGroup className="p-0" aria-label="Current project">
            <SidebarGroupLabel className="sidebar-section-label">
              Project
            </SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="sidebar-nav-button"
                  isActive={location.scale === "project"}
                  onClick={() =>
                    navigate({ scale: "project", projectId: book.id })
                  }
                >
                  <LayoutDashboard className="text-muted-foreground" />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
        {showContents && book && book.chapters.length > 0 && (
          <SidebarGroup className="p-0" aria-label="Table of contents">
            <SidebarGroupLabel className="sidebar-section-label">
              Textbook
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {book.chapters.map((chapter) => (
                  <Collapsible
                    key={chapter.id}
                    open={expanded.includes(chapter.id)}
                    onOpenChange={(open) =>
                      setExpanded((ids) =>
                        open
                          ? [...ids, chapter.id]
                          : ids.filter((id) => id !== chapter.id),
                      )
                    }
                    asChild
                  >
                    <SidebarMenuItem className="group/chapter">
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="sidebar-nav-button sidebar-chapter-button">
                          <ChevronRight className="mt-0.5 size-3.5 transition-transform duration-150 group-data-[state=open]/chapter:rotate-90" />
                          <span>{chapter.title}</span>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="mr-0 ml-[19px] gap-0.5 border-l px-1.5 py-1">
                          {chapter.sections.map((section) => {
                            const active =
                              location.scale === "section" &&
                              location.sectionId === section.id;
                            return (
                              <SidebarMenuSubItem key={section.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={active}
                                  className="sidebar-nav-button sidebar-section-button"
                                >
                                  <button
                                    type="button"
                                    aria-current={active ? "page" : undefined}
                                    onClick={() =>
                                      navigate({
                                        scale: "section",
                                        bookId: book.id,
                                        chapterId: chapter.id,
                                        sectionId: section.id,
                                      })
                                    }
                                  >
                                    <span>{section.title}</span>
                                  </button>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="sidebar-footer">{gettingStarted}</SidebarFooter>
    </Sidebar>
  );
}
