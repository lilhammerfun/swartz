import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type {
  LibrarySection,
  LibraryChange,
} from "@/features/projects/project-data";
import { projectError } from "@/features/projects/useProjects";

export type SectionAction =
  { kind: "create" } | { kind: "rename" | "delete"; section: LibrarySection };

/** 对具体分区执行单一操作；不把项目移动和分区创建混在一个流程。 */
export function LibrarySectionDialog({
  action,
  saving,
  onClose,
  onChange,
}: {
  action: SectionAction;
  saving: boolean;
  onClose: () => void;
  onChange: (change: LibraryChange) => Promise<void>;
}) {
  const [name, setName] = useState(
    action.kind === "create" ? "" : action.section.name,
  );
  const [error, setError] = useState("");
  const deleting = action.kind === "delete";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent role={deleting ? "alertdialog" : "dialog"}>
        <DialogTitle>
          {deleting
            ? "Delete section"
            : action.kind === "rename"
              ? "Rename section"
              : "New section"}
        </DialogTitle>
        <DialogDescription>
          {deleting
            ? `Delete “${action.section.name}”? Its projects will remain in Recent.`
            : "Choose a name for this section."}
        </DialogDescription>
        <form
          className="flex flex-col gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            setError("");
            try {
              await onChange(
                action.kind === "create"
                  ? {
                      kind: "create_section",
                      id: crypto.randomUUID(),
                      name: name.trim(),
                    }
                  : action.kind === "rename"
                    ? {
                        kind: "rename_section",
                        id: action.section.id,
                        name: name.trim(),
                      }
                    : { kind: "delete_section", id: action.section.id },
              );
              onClose();
            } catch (cause) {
              setError(projectError(cause));
            }
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!error}>
              {!deleting && (
                <>
                  <FieldLabel htmlFor="section-name">Section name</FieldLabel>
                  <Input
                    id="section-name"
                    autoFocus
                    required
                    maxLength={80}
                    value={name}
                    disabled={saving}
                    aria-invalid={!!error}
                    onChange={(event) => setName(event.target.value)}
                  />
                </>
              )}
              {error && <FieldError role="alert">{error}</FieldError>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              autoFocus={deleting}
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={deleting ? "destructive" : "default"}
              disabled={saving || (!deleting && !name.trim())}
            >
              {saving
                ? "Saving…"
                : deleting
                  ? "Delete section"
                  : action.kind === "create"
                    ? "Create section"
                    : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
