import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  Project,
  LibrarySection,
  LibraryChange,
} from "@/features/projects/project-data";
import { projectError } from "@/features/projects/useProjects";
import { BookCover } from "./BookCover";

type SectionDialog =
  { kind: "create" } | { kind: "rename" | "delete"; section: LibrarySection };

export function LibraryPage({
  projects,
  sections,
  loading,
  saving,
  error,
  onRetry,
  onOpen,
  onChange,
}: {
  projects: readonly Project[];
  sections: readonly LibrarySection[];
  loading: boolean;
  saving: boolean;
  error: string;
  onRetry: () => void;
  onOpen: (project: Project) => void;
  onChange: (change: LibraryChange) => Promise<void>;
}) {
  const [dialog, setDialog] = useState<SectionDialog | null>(null);
  const [name, setName] = useState("");
  const [actionError, setActionError] = useState("");
  const [dialogError, setDialogError] = useState("");
  function openDialog(next: SectionDialog) {
    setName(next.kind === "create" ? "" : next.section.name);
    setDialogError("");
    setDialog(next);
  }
  async function move(project: Project, sectionId: string | null) {
    setActionError("");
    try {
      await onChange({
        kind: "move_project",
        projectId: project.id,
        sectionId,
      });
    } catch (cause) {
      setActionError(projectError(cause));
    }
  }
  function shelf(items: readonly Project[]) {
    return items.length ? (
      <div className="library-bookshelf">
        {items.map((project) => (
          <div key={project.id} className="library-book-item">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="library-book"
                  aria-label={`Open project: ${project.title}`}
                  onClick={() => onOpen(project)}
                >
                  <BookCover id={project.id} title={project.title} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={10}>
                {project.title}
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="library-book-menu"
                  aria-label={`Organize ${project.title}`}
                  disabled={saving}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Move to section</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={project.librarySectionId ?? ""}
                  onValueChange={(value) => {
                    void move(project, value || null);
                  }}
                >
                  <DropdownMenuRadioItem value="">
                    Ungrouped
                  </DropdownMenuRadioItem>
                  {sections.map((section) => (
                    <DropdownMenuRadioItem key={section.id} value={section.id}>
                      {section.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    ) : (
      <p className="project-empty">No projects in this section.</p>
    );
  }
  const ungrouped = projects.filter((project) => !project.librarySectionId);
  return (
    <section className="library-page-scroll" aria-label="Library">
      <div className="library-page">
        <div className="library-toolbar">
          <Button
            variant="ghost"
            size="sm"
            disabled={loading || !!error || saving}
            onClick={() => openDialog({ kind: "create" })}
          >
            <Plus />
            New section
          </Button>
        </div>
        {actionError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {actionError}
          </p>
        )}
        {loading ? (
          <p role="status" className="project-empty">
            Loading projects…
          </p>
        ) : error ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : (
          <TooltipProvider delayDuration={450}>
            {sections.map((section) => (
              <div className="library-section" key={section.id}>
                <details open>
                  <summary className="library-section-title">
                    {section.name}
                  </summary>
                  {shelf(
                    projects.filter(
                      (project) => project.librarySectionId === section.id,
                    ),
                  )}
                </details>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="library-section-menu"
                      aria-label={`Section options: ${section.name}`}
                      disabled={saving}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => openDialog({ kind: "rename", section })}
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => openDialog({ kind: "delete", section })}
                    >
                      Delete section
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {ungrouped.length > 0 ? (
              sections.length ? (
                <details className="library-section" open>
                  <summary className="library-section-title">Ungrouped</summary>
                  {shelf(ungrouped)}
                </details>
              ) : (
                shelf(ungrouped)
              )
            ) : (
              !sections.length && (
                <p className="project-empty">
                  No projects yet. Start an exploration from Home.
                </p>
              )
            )}
          </TooltipProvider>
        )}
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setDialog(null);
        }}
      >
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!dialog || saving) return;
              setDialogError("");
              try {
                if (dialog.kind === "delete")
                  await onChange({
                    kind: "delete_section",
                    id: dialog.section.id,
                  });
                else if (dialog.kind === "rename")
                  await onChange({
                    kind: "rename_section",
                    id: dialog.section.id,
                    name: name.trim(),
                  });
                else
                  await onChange({
                    kind: "create_section",
                    id: crypto.randomUUID(),
                    name: name.trim(),
                  });
                setDialog(null);
              } catch (cause) {
                setDialogError(projectError(cause));
              }
            }}
          >
            <DialogTitle>
              {dialog?.kind === "delete"
                ? "Delete section"
                : dialog?.kind === "rename"
                  ? "Rename section"
                  : "New section"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === "delete"
                ? `Projects in “${dialog.section.name}” will move to Ungrouped.`
                : "Organize your projects on the bookshelf."}
            </DialogDescription>
            {dialog?.kind !== "delete" && (
              <div className="space-y-2">
                <label htmlFor="section-name">Section name</label>
                <Input
                  id="section-name"
                  autoFocus
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={saving}
                />
              </div>
            )}
            {dialogError && (
              <p role="alert" className="text-sm text-destructive">
                {dialogError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setDialog(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={dialog?.kind === "delete" ? "destructive" : "default"}
                disabled={saving || (dialog?.kind !== "delete" && !name.trim())}
              >
                {saving
                  ? "Saving…"
                  : dialog?.kind === "delete"
                    ? "Delete section"
                    : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
