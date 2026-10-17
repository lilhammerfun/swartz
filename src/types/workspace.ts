import type { Thread } from "./learning";

export type Panel = "map" | "tutorial" | "pending" | null;
export type Quote = {
  tutorialId: string;
  chapterId: string;
  version: number;
  text: string;
  sourceThreadId: string;
  sourceMessageId: string;
  sourceMessageIds?: string[];
};
export type StudyThread = Thread & {
  projectId: string | null;
  quote?: Quote;
  decisionId?: string;
};
export type Project = {
  key: string;
  label: string;
  monogram: string;
  scope: string;
  domain: string;
};
export type Decision = {
  id: string;
  threadId: string;
  question: string;
  reason: string;
  proposedName: string;
  proposedScope: string;
  status: "waiting" | "failed" | "done";
  candidates: { key: string; label: string; scope: string; effect: string }[];
  selected?: string;
};
export type Chapter = {
  id: string;
  title: string;
  version: number;
  paragraphs: string[];
  filename: string;
  code: string[];
  codeSourceMessageId?: string;
  sourceThreadId: string;
  sourceMessageId: string;
  paragraphSources?: string[];
};
export type Tutorial = {
  id: string;
  projectId: string;
  title: string;
  chapters: Chapter[];
  status: "ready" | "failed";
  updatedAt: string;
};
export type Evidence = {
  id: string;
  domain: string;
  conceptId: string;
  text: string;
  observedAt: string;
  threadId: string;
  messageId: string;
  kind: "explanation" | "misconception";
};
export type WorkspaceState = {
  version: 2;
  threads: StudyThread[];
  projects: Project[];
  decisions: Decision[];
  tutorials: Tutorial[];
  activeThreadId: string;
  panel: Panel;
  collapsed: boolean;
  drafts: Record<string, string>;
  deferredDecisionIds?: string[];
};
