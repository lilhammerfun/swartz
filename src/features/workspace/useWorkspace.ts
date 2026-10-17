import { useEffect, useRef, useState } from "react";
import { migrateWorkspace } from "./migrateWorkspace";
import { projectSuggestion } from "../../mock-data/project-suggestions";
import { productSeed } from "../../mock-data/product";
import { domainExamples } from "../../mock-data/learning";
import { replyFor } from "../../mock-data/conversations";
import type { Quote, StudyThread, WorkspaceState } from "../../types/workspace";

const STORAGE_KEY = "tukdam.workspace.v2";
function load(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw) as WorkspaceState;
      if (
        state.version === 2 &&
        Array.isArray(state.threads) &&
        Array.isArray(state.projects) &&
        Array.isArray(state.tutorials) &&
        Array.isArray(state.decisions) &&
        state.threads.some((thread) => thread.id === state.activeThreadId)
      )
        return state;
    }
    const old = localStorage.getItem("tukdam.workspace.v1");
    if (old) {
      const migrated = migrateWorkspace(JSON.parse(old));
      if (migrated) return migrated;
    }
  } catch {
    /* Keep the existing stored value; do not overwrite it during reading. */
  }
  return structuredClone(productSeed);
}

function archive(state: WorkspaceState, threadId: string): WorkspaceState {
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread?.projectId) return state;
  let tutorials = state.tutorials;
  for (const message of thread.messages) {
    if (
      message.role !== "assistant" ||
      /^\w+-\d+-\d+$/.test(message.id) ||
      tutorials.some((tutorial) =>
        tutorial.chapters.some(
          (chapter) =>
            chapter.sourceMessageId === message.id ||
            chapter.paragraphSources?.includes(message.id),
        ),
      )
    )
      continue;
    const paragraphs = (message.blocks ?? []).flatMap((block) =>
      block.kind === "answer" ? [block.text] : [],
    );
    if (!paragraphs.length) continue;
    const code = message.blocks?.find((block) => block.kind === "code");
    const existing = tutorials.find(
      (tutorial) => tutorial.projectId === thread.projectId,
    );
    const chapter = existing?.chapters.find(
      (item) =>
        item.sourceThreadId === thread.id &&
        (!code ||
          !item.code.length ||
          JSON.stringify(item.code) === JSON.stringify(code.lines)),
    );
    if (chapter && existing) {
      const revised = {
        ...chapter,
        version: chapter.version + 1,
        filename: chapter.code.length
          ? chapter.filename
          : (code?.filename ?? ""),
        code: chapter.code.length ? chapter.code : (code?.lines ?? []),
        codeSourceMessageId: chapter.code.length
          ? (chapter.codeSourceMessageId ?? chapter.sourceMessageId)
          : code
            ? message.id
            : undefined,
        paragraphs: [...chapter.paragraphs, ...paragraphs],
        paragraphSources: [
          ...(chapter.paragraphSources ??
            chapter.paragraphs.map(() => chapter.sourceMessageId)),
          ...paragraphs.map(() => message.id),
        ],
      };
      tutorials = tutorials.map((tutorial) =>
        tutorial.id === existing.id
          ? {
              ...tutorial,
              chapters: tutorial.chapters.map((item) =>
                item.id === chapter.id ? revised : item,
              ),
            }
          : tutorial,
      );
    } else {
      const added = {
        id: `chapter-${message.id}`,
        title: thread.label,
        version: 1,
        paragraphs,
        paragraphSources: paragraphs.map(() => message.id),
        filename: code?.kind === "code" ? code.filename : "",
        code: code?.kind === "code" ? code.lines : [],
        sourceThreadId: thread.id,
        sourceMessageId: message.id,
      };
      if (existing)
        tutorials = tutorials.map((tutorial) =>
          tutorial.id === existing.id
            ? { ...tutorial, chapters: [...tutorial.chapters, added] }
            : tutorial,
        );
      else
        tutorials = [
          ...tutorials,
          {
            id: `tutorial-${thread.projectId}`,
            projectId: thread.projectId,
            title:
              state.projects.find((project) => project.key === thread.projectId)
                ?.label ?? thread.label,
            chapters: [added],
            status: "ready",
            updatedAt: new Date().toISOString(),
          },
        ];
    }
  }
  return { ...state, tutorials };
}

export function useWorkspace() {
  const [state, setState] = useState(load);
  const [saveError, setSaveError] = useState(false);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const current = useRef(state);
  current.current = state;
  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current.current));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  };
  useEffect(persist, [state]);
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
    },
    [],
  );
  const active = state.threads.find(
    (thread) => thread.id === state.activeThreadId,
  )!;
  const edit = (change: Partial<WorkspaceState>) =>
    setState((previous) => ({ ...previous, ...change }));
  const select = (id: string) =>
    setState((previous) => {
      const thread = previous.threads.find((item) => item.id === id);
      return thread ? { ...previous, activeThreadId: id } : previous;
    });
  const newChat = (quote?: Quote, projectId: string | null = null) => {
    const id = crypto.randomUUID();
    const source = quote
      ? current.current.threads.find(
          (thread) => thread.id === quote.sourceThreadId,
        )
      : undefined;
    const project = current.current.projects.find(
      (item) => item.key === projectId,
    );
    const domain = project?.domain ?? source?.domain ?? active.domain;
    const thread: StudyThread = {
      id,
      label: quote ? "引用追问" : "新对话",
      domain,
      focus: "",
      mastery: null,
      projectId: project?.key ?? null,
      messages: [],
      quote,
    };
    setState((previous) => ({
      ...previous,
      threads: [thread, ...previous.threads],
      activeThreadId: id,
    }));
  };
  const confirm = (decisionId: string, choice: string, custom = "") =>
    setState((previous) => {
      const request = previous.decisions.find((item) => item.id === decisionId);
      const thread = previous.threads.find(
        (item) => item.id === request?.threadId,
      );
      if (!request || request.status === "done" || !thread || thread.projectId)
        return previous;
      const existing = previous.projects.find(
        (project) => project.key === choice,
      );
      const label = existing?.label ?? custom.trim();
      if (
        !label ||
        (!existing &&
          previous.projects.some(
            (project) =>
              project.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
          ))
      )
        return previous;
      const key = existing?.key ?? crypto.randomUUID();
      const projects = existing
        ? previous.projects
        : [
            ...previous.projects,
            {
              key,
              label,
              monogram: label.slice(0, 2),
              domain: thread.domain,
              scope: request.proposedScope,
            },
          ];
      return archive(
        {
          ...previous,
          projects,
          threads: previous.threads.map((item) =>
            item.id === thread.id ? { ...item, projectId: key } : item,
          ),
          decisions: previous.decisions.map((item) =>
            item.id === decisionId
              ? { ...item, status: "done", selected: label }
              : item,
          ),
        },
        thread.id,
      );
    });
  const retry = (id: string) =>
    setState((previous) => ({
      ...previous,
      tutorials: previous.tutorials.map((tutorial) =>
        tutorial.id === id ? { ...tutorial, status: "ready" } : tutorial,
      ),
    }));
  const send = (text: string) => {
    if (!text.trim()) return;
    const thread = current.current.threads.find(
      (item) => item.id === current.current.activeThreadId,
    )!;
    if (timers.current.has(thread.id)) return;
    const question = text.trim();
    const id = crypto.randomUUID();
    setState((previous) => ({
      ...previous,
      drafts: { ...previous.drafts, [thread.id]: "" },
      threads: previous.threads.map((item) =>
        item.id === thread.id
          ? {
              ...item,
              label: item.messages.length ? item.label : question.slice(0, 24),
              focus: item.focus || question,
              messages: [
                ...item.messages,
                { id, role: "user", text: question },
              ],
            }
          : item,
      ),
    }));
    respond(thread, question, id);
  };
  const respond = (
    thread: StudyThread,
    question: string,
    userMessageId: string,
  ) => {
    if (timers.current.has(thread.id)) return;
    setBusyIds((previous) => [...previous, thread.id]);
    const timer = setTimeout(() => {
      const response = replyFor(thread, crypto.randomUUID());
      response.inReplyTo = userMessageId;
      if (
        /出题|小测|测验|检验.*理解/.test(question) &&
        !/不要|不用|不想|不需要|别/.test(question)
      )
        response.blocks?.push({
          kind: "question",
          prompt: domainExamples[thread.domain].question,
          options: domainExamples[thread.domain].options,
          correct: 0,
          explanation: domainExamples[thread.domain].explanation,
        });
      setState((previous) => {
        const existing = previous.threads.find((item) => item.id === thread.id);
        if (
          existing?.messages.some(
            (message) => message.inReplyTo === userMessageId,
          )
        )
          return previous;
        if (!existing) return previous;
        const decision =
          !existing.projectId &&
          !previous.decisions.some((item) => item.threadId === thread.id)
            ? projectSuggestion(
                existing,
                previous.projects,
                crypto.randomUUID(),
              )
            : null;
        return archive(
          {
            ...previous,
            decisions: decision
              ? [...previous.decisions, decision]
              : previous.decisions,
            threads: previous.threads.map((item) =>
              item.id === thread.id
                ? {
                    ...item,
                    messages: [...item.messages, response],
                    decisionId: decision?.id ?? item.decisionId,
                  }
                : item,
            ),
          },
          thread.id,
        );
      });
      timers.current.delete(thread.id);
      setBusyIds((previous) => previous.filter((id) => id !== thread.id));
    }, 650);
    timers.current.set(thread.id, timer);
  };
  const retryAnswer = () => {
    const thread = current.current.threads.find(
      (item) => item.id === current.current.activeThreadId,
    )!;
    const last = thread.messages.at(-1);
    if (last?.role === "user" && last.text) respond(thread, last.text, last.id);
  };
  return {
    state,
    active,
    edit,
    select,
    newChat,
    send,
    confirm,
    retry,
    busy: busyIds.includes(active.id),
    retryAnswer,
    saveError,
    persist,
  };
}
