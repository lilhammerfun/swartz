import type {
  Decision,
  Project,
  Quote,
  StudyThread,
  Tutorial,
  WorkspaceState,
} from "../../types/workspace";

type LegacyState = {
  version: 1;
  threads: (Omit<StudyThread, "projectId" | "quote"> & {
    topicId: string | null;
    quote?: Omit<Quote, "tutorialId"> & { bookId: string };
  })[];
  topics: Omit<Project, "domain">[];
  books: (Omit<Tutorial, "projectId"> & { topicId: string })[];
  decisions: Omit<Decision, "proposedName" | "proposedScope">[];
  activeThreadId: string;
  panel: "books" | "map" | "pending" | null;
  collapsed: boolean;
  drafts: Record<string, string>;
  deferredDecisionIds?: string[];
};

/** Copy the old workspace into the project model, leaving its storage untouched. */
export function migrateWorkspace(input: unknown): WorkspaceState | null {
  const old = input as LegacyState;
  if (
    old?.version !== 1 ||
    !Array.isArray(old.threads) ||
    !Array.isArray(old.topics) ||
    !Array.isArray(old.books) ||
    !Array.isArray(old.decisions) ||
    !old.threads.some((thread) => thread.id === old.activeThreadId)
  )
    return null;
  const projects: Project[] = old.topics.map((topic) => ({
    key: topic.key,
    label: topic.label,
    monogram: topic.monogram,
    scope: topic.scope,
    domain:
      old.threads.find((thread) => thread.topicId === topic.key)?.domain ??
      "rust",
  }));
  const tutorials: Tutorial[] = [];
  const tutorialIds = new Map<string, string>();
  for (const { topicId, ...book } of old.books) {
    const existing = tutorials.find(
      (tutorial) => tutorial.projectId === topicId,
    );
    tutorialIds.set(book.id, existing?.id ?? book.id);
    if (existing) {
      const known = new Set(existing.chapters.map((chapter) => chapter.id));
      existing.chapters.push(
        ...book.chapters.filter((chapter) => !known.has(chapter.id)),
      );
      if (book.status === "failed") existing.status = "failed";
    } else
      tutorials.push({
        ...book,
        chapters: [...book.chapters],
        projectId: topicId,
      });
  }
  const threads: StudyThread[] = old.threads.map(
    ({ topicId, quote, ...thread }) => ({
      ...thread,
      projectId: topicId,
      quote: quote
        ? {
            tutorialId: tutorialIds.get(quote.bookId) ?? quote.bookId,
            chapterId: quote.chapterId,
            version: quote.version,
            text: quote.text,
            sourceThreadId: quote.sourceThreadId,
            sourceMessageId: quote.sourceMessageId,
            sourceMessageIds: quote.sourceMessageIds,
          }
        : undefined,
    }),
  );
  // A former scope-expansion request is not consent to move an assigned chat.
  // Its complete old record remains in the v1 namespace.
  const decisions: Decision[] = old.decisions
    .filter(
      (request) =>
        request.status === "done" ||
        threads.some(
          (thread) => thread.id === request.threadId && !thread.projectId,
        ),
    )
    .map((request) => ({
      ...request,
      question: "把这段学习整理为项目？",
      reason: "创建一个项目，或归入已有项目。对话和引用会完整保留。",
      proposedName:
        request.selected ??
        threads.find((thread) => thread.id === request.threadId)?.label ??
        "新的学习项目",
      proposedScope: request.reason,
      candidates: projects.map((project) => ({
        key: project.key,
        label: project.label,
        scope: project.scope,
        effect: "会话归入此项目，讲解整理进同一教程。",
      })),
    }));
  return {
    version: 2,
    projects,
    threads,
    tutorials,
    decisions,
    activeThreadId: old.activeThreadId,
    panel: old.panel === "books" ? "tutorial" : old.panel,
    collapsed: old.collapsed,
    drafts: old.drafts ?? {},
    deferredDecisionIds: old.deferredDecisionIds ?? [],
  };
}
