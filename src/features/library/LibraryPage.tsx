import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import type {
  Project,
  LibrarySection,
  LibraryChange,
} from "@/features/projects/project-data";
import { orderRecentProjects } from "@/features/projects/project-data";
import { projectError } from "@/features/projects/useProjects";
import { Link } from "react-router";
import { IconButton } from "@/components/ui/IconButton";
import type { SectionAction } from "./LibrarySectionDialog";
import { BookCover } from "./BookCover";

export function LibraryPage({
  projects,
  sections,
  saving,
  onOpen,
  onChange,
  selecting,
  onSelectingChange,
  sectionId = null,
  recent,
  showAll = false,
  onSectionAction,
  onSearch,
}: {
  projects: readonly Project[];
  sections: readonly LibrarySection[];
  saving: boolean;
  onOpen: (project: Project) => void;
  onChange: (change: LibraryChange) => Promise<void>;
  selecting: boolean;
  onSelectingChange: (value: boolean) => void;
  sectionId?: string | null;
  showAll?: boolean;
  onSectionAction: (action: SectionAction) => void;
  onSearch: () => void;
  recent: readonly { bookId?: string; updatedAt: string }[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const section = sections.find((item) => item.id === sectionId);
  // Recent 是所有项目的系统视图，不能用空分区归属来过滤。
  const visible = section
    ? projects.filter((item) => item.librarySectionId === section.id)
    : orderRecentProjects(projects, recent);
  const ids = selected.filter((id) => visible.some((item) => item.id === id));
  async function move(sectionId: string | null) {
    setError("");
    try {
      await onChange({ kind: "move_projects", projectIds: ids, sectionId });
      setSelected([]);
      onSelectingChange(false);
    } catch (cause) {
      setError(projectError(cause));
    }
  }
  function shelf(items: readonly Project[], preview = false) {
    return (
      <div
        className={
          preview
            ? "library-bookshelf library-bookshelf-preview"
            : "library-bookshelf"
        }
      >
        {items.map((project) => {
          const checked = ids.includes(project.id);
          return (
            <button
              key={project.id}
              type="button"
              className="library-book"
              aria-label={`${selecting ? "Select" : "Open project:"} ${project.title}`}
              aria-pressed={selecting ? checked : undefined}
              disabled={saving}
              onClick={() => {
                if (!selecting) return onOpen(project);
                setSelected((current) =>
                  checked
                    ? current.filter((id) => id !== project.id)
                    : [...current, project.id],
                );
              }}
            >
              <BookCover id={project.id} title={project.title} />
              {selecting && (
                <span
                  className="library-selection-check"
                  data-checked={checked}
                >
                  {checked && <Check size={14} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
  const fullView = !!section || showAll || selecting;
  const shelves = fullView
    ? [
        {
          id: section?.id ?? null,
          name: section?.name ?? "Recent",
          items: visible,
        },
      ]
    : [
        { id: null, name: "Recent", items: visible },
        ...sections.map((item) => ({
          ...item,
          items: projects.filter(
            (project) => project.librarySectionId === item.id,
          ),
        })),
      ];
  return (
    <section className="library-page-scroll" aria-label="Library">
      <div className="library-page">
        <header className="library-page-header">
          <div className="library-page-heading">
            <h1>Library</h1>
            <p>Your projects, organized in one place.</p>
          </div>
          {selecting ? (
            <div className="library-selection-tools">
              <span className="text-xs text-muted-foreground" role="status">
                {ids.length} selected
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={saving || !visible.length}
                onClick={() =>
                  setSelected(
                    ids.length === visible.length
                      ? []
                      : visible.map((item) => item.id),
                  )
                }
              >
                {ids.length === visible.length ? "Deselect all" : "Select all"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving || !ids.length || !sections.length}
                  >
                    Move to section
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    {sections.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onSelect={() => void move(item.id)}
                      >
                        {item.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {section && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={saving || !ids.length}
                  onClick={() => void move(null)}
                >
                  Remove from section
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setSelected([]);
                  setError("");
                  onSelectingChange(false);
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="library-page-tools">
              <Button
                variant="outline"
                className="library-search-trigger justify-start gap-2"
                aria-label="Search library"
                aria-haspopup="dialog"
                aria-keyshortcuts="Control+K Meta+K"
                onClick={onSearch}
              >
                <Search data-icon="inline-start" />
                <span className="min-w-0 flex-1 truncate text-left font-normal text-muted-foreground">
                  Search library…
                </span>
                <Kbd
                  className="hidden text-foreground sm:inline-flex"
                  aria-hidden
                >
                  {/Mac/.test(navigator.platform) ? "⌘ K" : "Ctrl K"}
                </Kbd>
              </Button>
              <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton label="Library options" disabled={saving}>
                      <MoreHorizontal />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onSelect={() => onSectionAction({ kind: "create" })}
                      >
                        New section
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!projects.length}
                        onSelect={() => onSelectingChange(true)}
                      >
                        Select projects
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button asChild size="sm">
                  <Link to="/">
                    <Plus data-icon="inline-start" />
                    New project
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </header>
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {shelves.map((group) => (
          <section
            key={group.id ?? "recent"}
            className="library-shelf"
            aria-label={group.name}
          >
            <header className="library-shelf-header">
              <h2>{group.name}</h2>
              <div className="flex items-center gap-1">
                {!fullView && (
                  <IconButton
                    asChild
                    label={`View all: ${group.name}`}
                    variant="link"
                    className="rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <Link
                      to={
                        group.id
                          ? `/library?section=${encodeURIComponent(group.id)}`
                          : "/library?view=recent"
                      }
                    >
                      <ChevronRight />
                    </Link>
                  </IconButton>
                )}
                {group.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        label={`Section options: ${group.name}`}
                        variant="link"
                        className="rounded-full text-muted-foreground hover:text-foreground"
                        disabled={saving}
                      >
                        <MoreHorizontal />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onSelect={() =>
                            onSectionAction({
                              kind: "rename",
                              section: { id: group.id!, name: group.name },
                            })
                          }
                        >
                          Rename section
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            onSectionAction({
                              kind: "delete",
                              section: { id: group.id!, name: group.name },
                            })
                          }
                        >
                          Delete section
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </header>
            {group.items.length ? (
              shelf(group.items, !fullView)
            ) : (
              <p className="project-empty">
                {group.id
                  ? "No projects in this section."
                  : "No projects yet. Start an exploration from Home."}
              </p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
