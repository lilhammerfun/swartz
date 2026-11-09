import { FolderOpen } from "@/components/ui/icons";

export function BookCover({ title }: { id: string; title: string }) {
  return (
    <span className="project-cover">
      <FolderOpen className="project-cover-icon" aria-hidden="true" />
      <span className="project-cover-title">{title}</span>
    </span>
  );
}
