import type { LearningBook } from "../../types/book.ts";

/** 与 Rust projects/data.rs 的读取契约一致；不包含原生会话日志。 */
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
  | { kind: "move_project"; projectId: string; sectionId: string | null };

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
 * 兼容现有阅读器和会话的 bookId 路由：工作区以项目 ID 为稳定身份，
 * 即使教材还不存在，也能进入同一个项目会话。教材自身 ID 保留在详情中。
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

/** 封面外观由稳定 ID 决定，改名不会导致整张书封换色。 */
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
