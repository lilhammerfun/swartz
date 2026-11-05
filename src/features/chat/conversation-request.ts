import type { ModelRequestOptions } from "../model/model-api.ts";
import type { ChatSession, ConversationMessage } from "./chat-store.ts";

/**
 * Business inputs for learning conversations, without system prompts, provider messages, or credentials.
 * Projects own conversations; learning days group records without resetting model context.
 * Existing Home chats retain their storage IDs until they are assigned to a project.
 *
 * Chat history still lives in the frontend; history is a snapshot excluding the current question.
 * Rust will load Goal, Plan, and the current Textbook by projectId; quotes retain their original version.
 * Drafts belong to the UI. useChat currently owns execution state, which will later move to Rust.
 * These contracts are not yet connected to Rust/Rig; live requests still use askModel.
 */
export type ConversationTarget =
  | { kind: "project"; projectId: string }
  | { kind: "unassigned"; conversationId: string };

export type ConversationInput =
  | { kind: "question"; message: ConversationMessage & { role: "user" } }
  | { kind: "start_learning" };

export interface ConversationRequest {
  target: ConversationTarget;
  /** Identifies one execution attempt; retries retain the user message ID and replace this ID. */
  requestId: string;
  input: ConversationInput;
  history: ConversationMessage[];
  options: ModelRequestOptions;
}

export interface ConversationResult {
  target: ConversationTarget;
  requestId: string;
  /** Proactive guidance has no corresponding user message. */
  userMessageId?: string;
  outcome:
    | { status: "completed"; text: string }
    | { status: "failed"; error: string }
    | { status: "cancelled" };
}

/** Maps legacy storage into a business request without creating sessions, grouping days, or calling a model. */
export function prepareQuestionRequest(
  session: ChatSession,
): ConversationRequest {
  const request = session.request;
  const question = session.messages.at(-1);
  if (
    !request ||
    !question ||
    question.role !== "user" ||
    question.id !== request.userMessageId
  )
    throw new Error("The pending question could not be found.");

  return {
    target: session.bookId
      ? // projectBook maps the legacy reader's bookId to project.id, not to the textbook's own ID.
        { kind: "project", projectId: session.bookId }
      : { kind: "unassigned", conversationId: session.id },
    requestId: request.id,
    input: {
      kind: "question",
      message: { ...structuredClone(question), role: "user" },
    },
    history: structuredClone(session.messages.slice(0, -1)),
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
