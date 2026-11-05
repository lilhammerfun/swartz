import type { Annotation } from "../../types/book.ts";
import type { ChatSession } from "./chat-store.ts";

/** Reader marks are a projection of quoted messages, never a separate conversation. */
export function sessionPassages(
  sessions: readonly ChatSession[],
): Annotation[] {
  return sessions.flatMap((session) =>
    session.messages.flatMap((message) =>
      message.role === "user" && message.passage
        ? [
            {
              id: message.id,
              anchor: message.passage,
              text: message.text,
              createdAt: message.createdAt,
              attachments: message.attachments,
            },
          ]
        : [],
    ),
  );
}
