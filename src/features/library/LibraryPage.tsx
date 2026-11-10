import {
  PageLayout,
  PageHeading,
  PageToolbar,
  SelectedCount,
} from "@/components/ui/page-layout";
import { Fragment, useEffect, useState } from "react";
import { Check, ChevronDown } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
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
import { useSearchParams } from "react-router";
import { BookCover } from "./BookCover";
import { EmptyState, RuntimeErrorNotice } from "@/components/ui/feedback";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const booksPerPage = 24;

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
}: {
  projects: readonly Project[];
  sections: readonly LibrarySection[];
  saving: boolean;
  onOpen: (project: Project) => void;
  onChange: (change: LibraryChange) => Promise<void>;
  selecting: boolean;
  onSelectingChange: (value: boolean) => void;
  sectionId?: string | null;
  recent: readonly { bookId?: string; updatedAt: string }[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const section = sections.find((item) => item.id === sectionId);
  // An unfiltered Library includes uncategorized projects, ordered by recent learning.
  const visible = section
    ? projects.filter((item) => item.librarySectionId === section.id)
    : orderRecentProjects(projects, recent);
  const ids = selected.filter((id) => visible.some((item) => item.id === id));
  const pageCount = Math.max(1, Math.ceil(visible.length / booksPerPage));
  const rawPage = params.get("page");
  const requestedPage = Number(rawPage ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, pageCount)
      : 1;
  const offset = (page - 1) * booksPerPage;
  const start = Math.max(1, Math.min(page - 1, pageCount - 2));
  const pages =
    pageCount <= 7
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : [...new Set([1, start, start + 1, start + 2, pageCount])].sort(
          (a, b) => a - b,
        );
  const pageItems = visible.slice(offset, offset + booksPerPage);
  const pageSelected =
    pageItems.length > 0 && pageItems.every((item) => ids.includes(item.id));
  // Normalize invalid links and return to the last available page after projects are moved.
  useEffect(() => {
    const canonical = page === 1 ? null : String(page);
    if (rawPage === canonical) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (canonical) next.set("page", canonical);
        else next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [rawPage, page, setParams]);

  const pageUrl = (page: number) => {
    const next = new URLSearchParams(params);
    if (page === 1) next.delete("page");
    else next.set("page", String(page));
    const search = next.toString();
    return search ? `/library?${search}` : "/library";
  };
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
  function shelf(items: readonly Project[]) {
    return (
      <div className="library-bookshelf">
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
                  aria-hidden="true"
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
  return (
    <PageLayout label="Library" className="library-page">
      <PageHeading
        title={section?.name ?? "All books"}
        description={
          section
            ? "Learning projects and textbooks in this category."
            : "Your learning projects and the textbooks you build along the way."
        }
      />
      {selecting && (
        <PageToolbar>
          <div className="library-selection-tools">
            <SelectedCount count={ids.length} />
            <Button
              size="sm"
              variant="ghost"
              disabled={saving || !pageItems.length}
              onClick={() =>
                setSelected(
                  pageSelected
                    ? ids.filter(
                        (id) => !pageItems.some((item) => item.id === id),
                      )
                    : [
                        ...new Set([
                          ...ids,
                          ...pageItems.map((item) => item.id),
                        ]),
                      ],
                )
              }
            >
              {pageSelected ? "Deselect page" : "Select page"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || !ids.length || !sections.length}
                >
                  Move to category
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
                Remove from category
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
        </PageToolbar>
      )}
      {error && (
        <RuntimeErrorNotice
          title="Could not update the library"
          className="mb-4"
        >
          {error}
        </RuntimeErrorNotice>
      )}
      <section
        className="library-shelf"
        aria-label={section?.name ?? "All books"}
      >
        {visible.length ? (
          shelf(pageItems)
        ) : (
          <EmptyState>
            {section
              ? "No books in this category. Move a project here from All books."
              : "No books yet. Start a learning project from Home."}
          </EmptyState>
        )}
      </section>
      {visible.length > 0 && (
        <footer>
          <Pagination aria-label="Library pages">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  to={pageUrl(Math.max(1, page - 1))}
                  aria-disabled={page === 1}
                  tabIndex={page === 1 ? -1 : undefined}
                  className={
                    page === 1 ? "pointer-events-none opacity-40" : undefined
                  }
                  onClick={
                    page === 1 ? (event) => event.preventDefault() : undefined
                  }
                />
              </PaginationItem>
              {pages.map((number, index) => (
                <Fragment key={number}>
                  {index > 0 && number - pages[index - 1] > 1 && (
                    <PaginationItem className="library-pagination-ellipsis">
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  <PaginationItem
                    className={
                      number !== page && pageCount > 3
                        ? "library-pagination-secondary-page"
                        : undefined
                    }
                  >
                    <PaginationLink
                      to={pageUrl(number)}
                      isActive={number === page}
                      aria-label={`Page ${number}`}
                    >
                      {number}
                    </PaginationLink>
                  </PaginationItem>
                </Fragment>
              ))}
              <PaginationItem>
                <PaginationNext
                  to={pageUrl(Math.min(pageCount, page + 1))}
                  aria-disabled={page === pageCount}
                  tabIndex={page === pageCount ? -1 : undefined}
                  className={
                    page === pageCount
                      ? "pointer-events-none opacity-40"
                      : undefined
                  }
                  onClick={
                    page === pageCount
                      ? (event) => event.preventDefault()
                      : undefined
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </footer>
      )}
    </PageLayout>
  );
}
