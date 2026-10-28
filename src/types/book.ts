export interface Paragraph {
  id: string;
  text: string;
  kind?: "prose" | "code";
}

export interface BookSection {
  id: string;
  title: string;
  subtitle: string;
  paragraphs: readonly Paragraph[];
}

export interface BookChapter {
  id: string;
  title: string;
  purpose: string;
  sections: readonly BookSection[];
}

export interface LearningBook {
  id: string;
  title: string;
  subtitle: string;
  version: number;
  chapters: readonly BookChapter[];
}

export interface AnnotationAnchor {
  bookId: string;
  chapterId: string;
  sectionId: string;
  paragraphId: string;
  version: number;
  quote: string;
}

export interface PromptAttachment {
  id: string;
  name: string;
  text: string;
}

export interface DiscussionMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: PromptAttachment[];
}

export interface Annotation {
  id: string;
  /** Legacy snapshot field; new annotations originate from AI discussions. */
  kind: "note" | "question";
  anchor: AnnotationAnchor;
  text: string;
  attachments?: PromptAttachment[];
  createdAt: string;
  messages: DiscussionMessage[];
}

export type ReaderLocation =
  | { scale: "home" }
  | { scale: "library" }
  | { scale: "project"; projectId: string }
  | { scale: "settings" }
  | { scale: "chat"; conversationId: string }
  | { scale: "book"; bookId: string }
  | { scale: "section"; bookId: string; chapterId: string; sectionId: string };
