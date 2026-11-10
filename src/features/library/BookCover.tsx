import { coverStyle } from "@/features/projects/project-data";

export function BookCover({ id, title }: { id: string; title: string }) {
  return (
    <span className={`project-cover project-cover-${coverStyle(id)}`}>
      <span className="project-cover-imprint" aria-hidden="true">
        Personal textbook
      </span>
      <span className="project-cover-title">{title}</span>
      <span className="project-cover-art" aria-hidden="true" />
    </span>
  );
}
