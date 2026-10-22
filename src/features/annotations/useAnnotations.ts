import { useRef, useState } from "react";
import type {
  Annotation,
  AnnotationAnchor,
  PromptAttachment,
} from "../../types/book";
import {
  parseAnnotations,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  migrateAnnotations,
  appendAnnotation,
  saveAnnotationSnapshot,
} from "./annotation-store";
import {
  answeredAnnotation,
  appendAnsweredExchange,
} from "./answered-discussion";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      annotations: raw
        ? parseAnnotations(raw)
        : migrateAnnotations(
            parseAnnotations(localStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]"),
          ),
      error: "",
      errorKind: null as "load" | "save" | null,
    };
  } catch {
    return {
      annotations: [] as Annotation[],
      error:
        "Unable to load annotations. Your stored data has not been changed.",
      errorKind: "load" as const,
    };
  }
}
export function useAnnotations() {
  const [snapshot, setSnapshot] = useState(load);
  const current = useRef(snapshot);
  const save = (annotations: Annotation[]) => {
    let error = "";
    try {
      saveAnnotationSnapshot(localStorage, annotations);
    } catch {
      error =
        "Your discussion is available here but could not be saved. Please retry saving.";
    }
    const next = {
      annotations,
      error,
      errorKind: error ? ("save" as const) : null,
    };
    current.current = next;
    setSnapshot(next);
  };
  return {
    ...snapshot,
    addAnsweredQuestion: (
      anchor: AnnotationAnchor,
      question: string,
      answer: string,
      attachments: PromptAttachment[] = [],
    ) => {
      const annotation = answeredAnnotation(
        anchor,
        question,
        answer,
        attachments,
      );
      save(appendAnnotation(current.current.annotations, annotation));
      return annotation;
    },
    appendAnsweredExchange: (
      id: string,
      question: string,
      answer: string,
      attachments: PromptAttachment[] = [],
    ) =>
      save(
        appendAnsweredExchange(
          current.current.annotations,
          id,
          question,
          answer,
          attachments,
        ),
      ),
    retry: () => {
      if (current.current.errorKind === "save")
        save(current.current.annotations);
      else {
        const next = load();
        current.current = next;
        setSnapshot(next);
      }
    },
  };
}
