import type { Decision, Project, StudyThread } from "../types/workspace";

const suggestions: Record<string, { name: string; scope: string }> = {
  rust: {
    name: "Rust 的所有权",
    scope: "从移动与借用开始，理解 Rust 的资源归属、引用和生命周期。",
  },
  sql: {
    name: "数据库的执行机制",
    scope: "通过查询和事务的例子，理解数据库的执行、存储与并发。",
  },
  infra: {
    name: "模型推理系统",
    scope: "从一次请求开始，理解模型推理中的计算、缓存与调度。",
  },
  os: {
    name: "地址空间与内存管理",
    scope: "从进程访问内存开始，理解地址空间、分页和资源管理。",
  },
};

/** Fixed proposals for the UI flow; the production Agent will produce these fields. */
export function projectSuggestion(
  thread: StudyThread,
  projects: Project[],
  id: string,
): Decision {
  const suggestion = suggestions[thread.domain] ?? {
    name: thread.label,
    scope: thread.focus,
  };
  return {
    id,
    threadId: thread.id,
    status: "waiting",
    question: "把这段学习整理为项目？",
    reason: "会话、概念图和后续教程会放在同一个项目中。也可以继续独立聊天。",
    proposedName: suggestion.name,
    proposedScope: suggestion.scope,
    candidates: projects.map((project) => ({
      key: project.key,
      label: project.label,
      scope: project.scope,
      effect: "会话归入此项目，讲解整理进同一教程。",
    })),
  };
}
