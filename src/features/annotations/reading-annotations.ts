import type { Annotation, BookSection } from "../../types/book.ts";

export function readingAnnotations(
  annotations: readonly Annotation[],
  bookId: string,
  section: BookSection,
): Annotation[] {
  const positions = new Map(
    section.paragraphs.map((paragraph, index) => [paragraph.id, index]),
  );
  return annotations
    .filter(
      (annotation) =>
        annotation.anchor.bookId === bookId &&
        annotation.anchor.sectionId === section.id,
    )
    .sort(
      (left, right) =>
        (positions.get(left.anchor.paragraphId) ?? Infinity) -
          (positions.get(right.anchor.paragraphId) ?? Infinity) ||
        Date.parse(left.createdAt) - Date.parse(right.createdAt),
    );
}
