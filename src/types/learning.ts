export type LearningBlock =
  | { kind: "answer"; text: string }
  | { kind: "code"; filename: string; lines: string[] }
  | {
      kind: "question";
      prompt: string;
      options: string[];
      correct: number;
      explanation: string;
    };
export type LearningMessage = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  blocks?: LearningBlock[];
  inReplyTo?: string;
};
export type Thread = {
  id: string;
  label: string;
  domain: string;
  focus: string;
  mastery: number | null;
  messages: LearningMessage[];
};

export type Concept = {
  id: string;
  label: string;
  subtitle: string;
  mastery: number | null;
  x: number;
  y: number;
  prerequisites: string[];
};
export type MapData = {
  id: string;
  name: string;
  description: string;
  source: string;
  nodes: Concept[];
};
