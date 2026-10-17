import { threads } from "./conversations";
import { learningDomains } from "./workspace";
import { projectSuggestion } from "./project-suggestions";
import { domainExamples } from "./learning";
import type { WorkspaceState, Evidence } from "../types/workspace";

const projectNames: Record<string, string> = {
  rust: "Rust 入门",
  sql: "数据库原理",
  infra: "AI 推理系统",
  os: "操作系统基础",
};
const projects = learningDomains.map((domain) => ({
  key: domain.key,
  label: projectNames[domain.key],
  monogram: domain.monogram,
  domain: domain.key,
  scope: domainExamples[domain.key].intro,
}));
const independent = ["rust", "os"].map((domain) => {
  const original = threads.find((thread) => thread.id === `${domain}-7`)!;
  const id = `independent-${domain}`;
  return {
    ...original,
    id,
    projectId: null,
    messages: original.messages
      .slice(0, 4)
      .map((message, index) => ({ ...message, id: `${id}-${index}` })),
  };
});

export const productSeed: WorkspaceState = {
  version: 2,
  threads: [
    ...independent,
    ...threads.map((thread) => ({ ...thread, projectId: thread.domain })),
  ],
  projects,
  decisions: [
    projectSuggestion(independent[0], projects, "project-independent-rust"),
  ],
  tutorials: learningDomains.map((domain) => ({
    id: `tutorial-${domain.key}`,
    projectId: domain.key,
    title:
      {
        rust: "理解 Rust",
        sql: "数据库的执行机制",
        infra: "模型推理系统",
        os: "地址空间与内存管理",
      }[domain.key] ?? domain.label,
    status: domain.key === "sql" ? "failed" : "ready",
    updatedAt: "2026-10-12",
    chapters: threads
      .filter((thread) => thread.domain === domain.key)
      .slice(0, 4)
      .map((thread) => ({
        id: `chapter-${thread.id}`,
        title: thread.label,
        version: 1,
        paragraphs: [
          domainExamples[domain.key].intro,
          domainExamples[domain.key].explanation,
        ],
        filename: domainExamples[domain.key].filename,
        code: domainExamples[domain.key].lines,
        sourceThreadId: thread.id,
        sourceMessageId: `${thread.id}-4`,
        paragraphSources: [`${thread.id}-4`, `${thread.id}-8`],
      })),
  })),
  activeThreadId: "independent-rust",
  panel: null,
  collapsed: false,
  drafts: {},
};

export const evidenceSeed: Evidence[] = learningDomains.map((domain) => ({
  id: `evidence-${domain.key}`,
  domain: domain.key,
  conceptId:
    { rust: "borrow", sql: "snapshot", infra: "cache", os: "page" }[
      domain.key
    ] ?? "",
  text: domainExamples[domain.key].explanation,
  observedAt: "2026-10-12",
  threadId: `${domain.key}-0`,
  messageId: `${domain.key}-0-5`,
  kind: "explanation",
}));
