import type { LearningBook } from "../../types/book.ts";

/** Mirrors the read contract in Rust projects/data.rs without native session logs. */
export interface Project {
  id: string;
  title: string;
  description: string;
  librarySectionId?: string | null;
}

export interface LibrarySection {
  id: string;
  name: string;
}

export interface LibrarySnapshot {
  sections: LibrarySection[];
  projects: Project[];
}

export type LibraryChange =
  | { kind: "create_section"; id: string; name: string }
  | { kind: "rename_section"; id: string; name: string }
  | { kind: "delete_section"; id: string }
  | { kind: "move_project"; projectId: string; sectionId: string | null }
  | { kind: "move_projects"; projectIds: string[]; sectionId: string | null };

export type ExplorationStatus = "pending" | "in_progress" | "completed";

export interface PlanNode {
  id: string;
  title: string;
  description: string;
  status: ExplorationStatus | null;
  children: PlanNode[];
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  kind: "goal_updated" | "plan_updated" | "textbook_revised";
  description: string;
  occurredAt: string;
  sessionId: string;
  toolCallId: string;
}

export interface ProjectDetail {
  project: Project;
  goal: { projectId: string; version: number; content: string };
  plan: {
    projectId: string;
    version: number;
    overview: string;
    nodes: PlanNode[];
  };
  textbook: (LearningBook & { projectId: string }) | null;
  activities: ProjectActivity[];
}

/**
 * Supports existing reader and conversation bookId routes using the stable project ID,
 * even before a textbook exists. The textbook's own ID remains in the project detail.
 */
export function projectBook(
  project: Project,
  detail?: ProjectDetail,
): LearningBook {
  return {
    id: project.id,
    title: detail?.textbook?.title ?? project.title,
    subtitle: detail?.textbook?.subtitle ?? project.description,
    version: detail?.textbook?.version ?? 1,
    chapters: detail?.textbook?.chapters ?? [],
  };
}

/** Derive cover styling from a stable ID so renaming a project does not change its appearance. */
export function coverStyle(id: string): number {
  let hash = 0;
  for (const character of id)
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return hash % 6;
}

export function recentActivities(
  activities: ProjectActivity[],
): ProjectActivity[] {
  return [...activities].sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  );
}

/** Order recently used projects first; retain unvisited and unassigned projects in catalog order. */
export function orderRecentProjects(
  projects: readonly Project[],
  recent: readonly { bookId?: string; updatedAt: string }[],
): Project[] {
  const times = new Map<string, number>();
  for (const entry of recent) {
    if (entry.bookId)
      times.set(
        entry.bookId,
        Math.max(
          times.get(entry.bookId) ?? 0,
          Date.parse(entry.updatedAt) || 0,
        ),
      );
  }
  return [...projects].sort(
    (a, b) => (times.get(b.id) ?? 0) - (times.get(a.id) ?? 0),
  );
}
