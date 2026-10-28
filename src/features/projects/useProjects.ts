import { useCallback, useEffect, useRef, useState } from "react";
import { getProjectDetail, getLibrary, updateLibrary } from "./project-service";
import type {
  Project,
  ProjectDetail,
  LibrarySection,
  LibraryChange,
} from "./project-data";

export function projectError(cause: unknown): string {
  return typeof cause === "string"
    ? cause
    : cause instanceof Error
      ? cause.message
      : "Could not load this project.";
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sections, setSections] = useState<LibrarySection[]>([]);
  const [saving, setSaving] = useState(false);
  const writing = useRef(false);
  const [details, setDetails] = useState<Record<string, ProjectDetail>>({});
  const cache = useRef<Record<string, ProjectDetail>>({});
  const pending = useRef(new Map<string, Promise<ProjectDetail>>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getLibrary()
      .then((items) => {
        if (active) {
          setProjects(items.projects);
          setSections(items.sections);
        }
      })
      .catch((cause) => {
        if (active) setError(projectError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const loadDetail = useCallback((id: string): Promise<ProjectDetail> => {
    if (cache.current[id]) return Promise.resolve(cache.current[id]);
    const existing = pending.current.get(id);
    if (existing) return existing;
    // 同一项目同时被详情和工作区请求时，复用读取；响应始终按 ID 缓存。
    const request = getProjectDetail(id)
      .then((detail) => {
        cache.current[id] = detail;
        setDetails((current) => ({ ...current, [id]: detail }));
        return detail;
      })
      .finally(() => {
        pending.current.delete(id);
      });
    pending.current.set(id, request);
    return request;
  }, []);

  return {
    projects,
    sections,
    saving,
    updateLibrary: async (change: LibraryChange) => {
      if (writing.current)
        throw new Error("Wait for the current change to finish.");
      writing.current = true;
      setSaving(true);
      try {
        const next = await updateLibrary(change);
        setProjects(next.projects);
        setSections(next.sections);
        // 同步详情缓存中的归属信息，不触碰教材、计划或业务日志。
        for (const project of next.projects) {
          if (cache.current[project.id])
            cache.current[project.id] = {
              ...cache.current[project.id],
              project,
            };
        }
        setDetails({ ...cache.current });
      } finally {
        writing.current = false;
        setSaving(false);
      }
    },
    details,
    loading,
    error,
    loadDetail,
    getCached: (id: string) => cache.current[id],
    retry: () => setAttempt((value) => value + 1),
  };
}
