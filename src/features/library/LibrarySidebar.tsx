import { Link, useSearchParams } from "react-router";
import {
  BookOpen,
  Library,
  MoreHorizontal,
  Plus,
  Search,
} from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { LibrarySection, Project } from "@/features/projects/project-data";
import type { SectionAction } from "./LibrarySectionDialog";

export function LibrarySidebar({
  sections,
  projects,
  saving,
  onSectionAction,
  onSelectProjects,
  onSearch,
  active,
}: {
  sections: readonly LibrarySection[];
  projects: readonly Project[];
  saving: boolean;
  onSectionAction: (action: SectionAction) => void;
  onSelectProjects: (sectionId: string | null) => void;
  onSearch: () => void;
  active: boolean;
}) {
  const [params] = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => {
    if (isMobile) setOpenMobile(false);
  };
  const sectionId = active ? params.get("section") : null;
  function navigationItem(section?: LibrarySection) {
    const name = section?.name ?? "All books";
    return (
      <SidebarMenuItem
        key={section?.id ?? "all"}
        className="navigation-control library-navigation-row"
      >
        <SidebarMenuButton
          asChild
          className="sidebar-nav-button"
          isActive={active && sectionId === (section?.id ?? null)}
        >
          <Link
            to={
              section
                ? `/library?section=${encodeURIComponent(section.id)}`
                : "/library"
            }
            onClick={close}
          >
            {section ? <BookOpen /> : <Library />}
            <span>{name}</span>
          </Link>
        </SidebarMenuButton>
        <div className="library-navigation-actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                label={`Options: ${name}`}
                size="icon-xs"
                disabled={saving}
              >
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right">
              <DropdownMenuGroup>
                {!section && (
                  <DropdownMenuItem
                    onSelect={() => {
                      close();
                      onSectionAction({ kind: "create" });
                    }}
                  >
                    New category
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={
                    !projects.some(
                      (project) =>
                        !section || project.librarySectionId === section.id,
                    )
                  }
                  onSelect={() => {
                    close();
                    onSelectProjects(section?.id ?? null);
                  }}
                >
                  Select projects
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {section && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onSelect={() => {
                        close();
                        onSectionAction({ kind: "rename", section });
                      }}
                    >
                      Rename category
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        close();
                        onSectionAction({ kind: "delete", section });
                      }}
                    >
                      Delete category
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton asChild label="New project" size="icon-xs">
            <Link to="/" onClick={close}>
              <Plus />
            </Link>
          </IconButton>
        </div>
      </SidebarMenuItem>
    );
  }
  return (
    <Sidebar
      collapsible="offcanvas"
      className="book-sidebar"
      aria-label="Library navigation"
    >
      <SidebarHeader className="secondary-navigation-header library-sidebar-header">
        <span>Library</span>
        <IconButton
          label="Search library"
          aria-haspopup="dialog"
          aria-keyshortcuts="Control+K Meta+K"
          onClick={() => {
            close();
            onSearch();
          }}
        >
          <Search />
        </IconButton>
      </SidebarHeader>
      <SidebarContent className="sidebar-navigation">
        <SidebarGroup className="p-0">
          <SidebarMenu>{navigationItem()}</SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="p-0" aria-label="Book categories">
          <div className="flex items-center justify-between">
            <SidebarGroupLabel className="sidebar-section-label">
              Categories
            </SidebarGroupLabel>
            <IconButton
              label="New category"
              size="icon-xs"
              disabled={saving}
              onClick={() => {
                close();
                onSectionAction({ kind: "create" });
              }}
            >
              <Plus />
            </IconButton>
          </div>
          <SidebarMenu>
            {sections.map((section) => navigationItem(section))}
          </SidebarMenu>
          {!sections.length && (
            <p className="sidebar-empty">
              Add categories to organize your books.
            </p>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
