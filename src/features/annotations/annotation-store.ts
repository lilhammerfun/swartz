import type { Annotation } from "../../types/book.ts";

function validAttachments(files: unknown): boolean {
  return (
    files === undefined ||
    (Array.isArray(files) &&
      files.length <= 4 &&
      files.every(
        (file) =>
          file &&
          typeof file.id === "string" &&
          typeof file.name === "string" &&
          typeof file.text === "string" &&
          file.text.length <= 20000,
      ) &&
      files.reduce((n, file) => n + file.text.length, 0) <= 60000)
  );
}

export const STORAGE_KEY = "tukdam.reader.annotations.v2";
export const LEGACY_STORAGE_KEY = "tukdam.reader.annotations.v1";

/** Treat persisted data as untrusted; malformed snapshots must not break reading. */
export function parseAnnotations(raw: string): Annotation[] {
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Invalid annotation snapshot");
  const ids = new Set<string>();
  for (const value of data) {
    if (!value || typeof value !== "object")
      throw new Error("Invalid annotation");
    const a = value as Partial<Annotation>;
    if (
      typeof a.id !== "string" ||
      ids.has(a.id) ||
      !["note", "question"].includes(a.kind ?? "") ||
      typeof a.text !== "string" ||
      !validAttachments(a.attachments) ||
      typeof a.createdAt !== "string" ||
      !Number.isFinite(Date.parse(a.createdAt)) ||
      !a.anchor ||
      !Array.isArray(a.messages)
    )
      throw new Error("Invalid annotation fields");
    for (const key of [
      "bookId",
      "chapterId",
      "sectionId",
      "paragraphId",
      "quote",
    ] as const)
      if (typeof a.anchor[key] !== "string") throw new Error("Invalid anchor");
    if (!Number.isInteger(a.anchor.version) || a.anchor.version < 1)
      throw new Error("Invalid version");
    for (const m of a.messages)
      if (
        !m ||
        typeof m.id !== "string" ||
        !["user", "assistant"].includes(m.role) ||
        typeof m.text !== "string" ||
        !validAttachments(m.attachments)
      )
        throw new Error("Invalid discussion message");
    ids.add(a.id);
  }
  return data as Annotation[];
}

export function appendAnnotation(
  annotations: readonly Annotation[],
  annotation: Annotation,
): Annotation[] {
  if (annotations.some((a) => a.id === annotation.id)) return [...annotations];
  return [...annotations, structuredClone(annotation)];
}

/** Preserve an unreadable snapshot before replacing it with a usable one. */
export function saveAnnotationSnapshot(
  storage: Pick<Storage, "getItem" | "setItem">,
  annotations: readonly Annotation[],
): void {
  const previous = storage.getItem(STORAGE_KEY);
  if (previous !== null) {
    try {
      parseAnnotations(previous);
    } catch {
      const backupKey = `${STORAGE_KEY}.recovery.${Date.now()}`;
      storage.setItem(backupKey, previous);
    }
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(annotations));
}

/** Carry user writing forward while keeping the original v1 snapshot untouched. */
export function migrateAnnotations(
  annotations: readonly Annotation[],
): Annotation[] {
  const seededIds = new Set(["note-exclusive", "question-two", "note-range"]);
  return annotations.flatMap((annotation) => {
    const copy = structuredClone(annotation);
    copy.messages = copy.messages.filter(
      (m) =>
        m.id !== "reply-demo" &&
        !(
          m.role === "assistant" &&
          m.text.startsWith("这条回复用于演示原文旁的讨论布局")
        ),
    );
    if (!seededIds.has(copy.id)) return [copy];
    const firstUser = copy.messages.findIndex((m) => m.role === "user");
    if (firstUser < 0) return [];
    copy.text = copy.messages[firstUser].text;
    copy.messages = copy.messages.slice(firstUser + 1);
    return [copy];
  });
}
