import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function NewBookDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setTitle("");
      setError("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New book</DialogTitle>
          <DialogDescription>Give your book a title.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            try {
              onCreate(title);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Could not create this book.",
              );
            }
          }}
        >
          <Field>
            <FieldLabel htmlFor="new-book-title">Title</FieldLabel>
            <Input
              id="new-book-title"
              value={title}
              onChange={(event) => {
                setTitle(event.currentTarget.value);
                setError("");
              }}
              placeholder="e.g. Learning Rust"
              maxLength={160}
              required
              autoComplete="off"
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="outline" disabled={!title.trim()}>
              Create book
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
