import type {
  Annotation,
  AnnotationAnchor,
  PromptAttachment,
} from "../../types/book.ts";

function exchange(
  question: string,
  answer: string,
  attachments: PromptAttachment[] = [],
) {
  if (!question.trim() || !answer.trim())
    throw new Error("A question and an AI answer are required.");
  return [
    {
      id: crypto.randomUUID(),
      role: "user" as const,
      text: question.trim(),
      ...(attachments.length
        ? { attachments: structuredClone(attachments) }
        : {}),
    },
    {
      id: crypto.randomUUID(),
      role: "assistant" as const,
      text: answer.trim(),
    },
  ];
}
export function answeredAnnotation(
  anchor: AnnotationAnchor,
  question: string,
  answer: string,
  attachments: PromptAttachment[] = [],
): Annotation {
  const messages = exchange(question, answer, attachments);
  return {
    id: crypto.randomUUID(),
    kind: "question",
    anchor: structuredClone(anchor),
    text: question.trim(),
    ...(attachments.length
      ? { attachments: structuredClone(attachments) }
      : {}),
    createdAt: new Date().toISOString(),
    messages: [messages[1]],
  };
}
export function appendAnsweredExchange(
  annotations: readonly Annotation[],
  id: string,
  question: string,
  answer: string,
  attachments: PromptAttachment[] = [],
): Annotation[] {
  const messages = exchange(question, answer, attachments);
  if (!annotations.some((a) => a.id === id))
    throw new Error("This discussion could not be found.");
  return annotations.map((a) =>
    a.id === id ? { ...a, messages: [...a.messages, ...messages] } : a,
  );
}
