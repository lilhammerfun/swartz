import { useState } from "react";
import { ChevronRight, Home, Library, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
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
import type { LearningBook, ReaderLocation } from "@/types/book";

export function LibrarySidebar({
  book,
  location,
  onNavigate,
  onSearch,
  showContents = true,
}: {
  book: LearningBook;
  location: ReaderLocation;
  onNavigate: (location: ReaderLocation) => void;
  onSearch: () => void;
  showContents?: boolean;
}) {
  const [expanded, setExpanded] = useState(["ownership", "borrowing"]);
  const { isMobile, setOpenMobile } = useSidebar();
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
      <SidebarHeader className="px-2 pt-3 pb-0">
        <Button
          variant="outline"
          className="sidebar-search h-7.5 w-full justify-start gap-2 px-2.5 text-muted-foreground shadow-none"
          aria-label="Search"
          onClick={() => {
            if (isMobile) setOpenMobile(false);
            onSearch();
          }}
        >
          <span className="flex-1 text-left text-xs font-normal">Search</span>
          <Kbd className="text-[10px]">
            {/Mac/.test(navigator.platform) ? "⌘ K" : "Ctrl K"}
          </Kbd>
        </Button>
      </SidebarHeader>
      <SidebarContent className="gap-5 px-2 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {(
                [
                  { scale: "home", label: "Home", icon: Home },
                  { scale: "library", label: "Library", icon: Library },
                  { scale: "settings", label: "Settings", icon: Settings },
                ] as const
              ).map((item) => (
                <SidebarMenuItem key={item.scale}>
                  <SidebarMenuButton
                    isActive={
                      location.scale === item.scale ||
                      (item.scale === "library" && location.scale === "project")
                    }
                    aria-current={
                      location.scale === item.scale ||
                      (item.scale === "library" && location.scale === "project")
                        ? "page"
                        : undefined
                    }
                    onClick={() => navigate({ scale: item.scale })}
                    className="h-7 px-3 text-[13px]"
                  >
                    <item.icon className="text-muted-foreground" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {showContents && book.chapters.length > 0 && (
          <SidebarGroup className="p-0" aria-label="Table of contents">
            <SidebarGroupLabel className="mb-1 px-3 text-[11px] font-medium text-muted-foreground">
              Contents
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
                        <SidebarMenuButton className="h-auto min-h-9 items-start px-3 py-2 text-[13px] text-muted-foreground [&>span:last-child]:whitespace-normal [&>span:last-child]:overflow-visible">
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
                                  className="h-auto min-h-8 w-full py-1.5 text-left text-[12px] leading-5 text-muted-foreground data-active:font-medium [&>span:last-child]:whitespace-normal [&>span:last-child]:overflow-visible"
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
    </Sidebar>
  );
}
