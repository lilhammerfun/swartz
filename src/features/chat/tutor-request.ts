import type { ModelRequestOptions } from "../model/model-api.ts";
import type { ChatSession, ConversationMessage } from "./chat-store.ts";

/**
 * Inputs and results for Tutor execution, without system prompts, provider messages, or credentials.
 * Projects own conversations; learning days group records without resetting model context.
 * Existing Home chats retain their storage IDs until they are assigned to a project.
 *
 * Chat history still lives in the frontend; history is a snapshot excluding the current question.
 * Rust will load Goal, Plan, and the current Textbook by projectId; quotes retain their original version.
 * Drafts and saved chat messages belong to the UI. Rust's TutorService owns active native runs.
 * Model execution is owned by the Rust Tutor; the frontend only submits business inputs.
 */
export type ConversationTarget =
  | { kind: "project"; projectId: string }
  | { kind: "unassigned"; conversationId: string };

export type TutorInput =
  | { kind: "question"; message: ConversationMessage & { role: "user" } }
  | { kind: "start_learning" };

export interface TutorRequest {
  target: ConversationTarget;
  /** Identifies one execution attempt; retries retain the user message ID and replace this ID. */
  requestId: string;
  input: TutorInput;
  history: ConversationMessage[];
  options: ModelRequestOptions;
}

export interface TutorResult {
  outcome:
    | { status: "completed"; text: string }
    | { status: "failed"; error: string }
    | { status: "cancelled" };
}

/** Maps a saved conversation into a business request without creating sessions, grouping days, or calling a model. */
export function prepareTutorRequest(session: ChatSession): TutorRequest {
  const request = session.request;
  const question = session.messages.at(-1);
  if (
    !request ||
    (request.kind === "start_learning"
      ? !session.bookId
      : !question ||
        question.role !== "user" ||
        question.id !== request.userMessageId)
  )
    throw new Error("The pending question could not be found.");

  return {
    target: session.bookId
      ? // Reader bookId identifies the project, not the textbook's own ID.
        { kind: "project", projectId: session.bookId }
      : { kind: "unassigned", conversationId: session.id },
    requestId: request.id,
    input:
      request.kind === "start_learning"
        ? { kind: "start_learning" }
        : {
            kind: "question",
            message: { ...structuredClone(question!), role: "user" },
          },
    history: structuredClone(
      request.kind === "start_learning"
        ? session.messages
        : session.messages.slice(0, -1),
    ),
    options: {
      ...(request.options.model === undefined
        ? {}
        : { model: request.options.model }),
      ...(request.options.reasoningEffort === undefined
        ? {}
        : { reasoningEffort: request.options.reasoningEffort }),
    },
  };
}
