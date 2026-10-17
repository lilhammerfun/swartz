import type { ReactNode } from "react";
export type ChatHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: ReactNode;
};
/** Beautiful UI transcript surface; state and message data belong to the workspace. */
export default function ChatComposer({
  history,
  className = "",
}: {
  history: ChatHistoryMessage[];
  className?: string;
}) {
  return (
    <div className={`flex w-full flex-col gap-8 text-ink ${className}`}>
      {history.map((message) =>
        message.role === "user" ? (
          <div
            key={message.id}
            data-message-id={message.id}
            className="flex justify-end pl-10"
          >
            <div className="max-w-[90%] rounded-xl bg-field px-4 py-3 text-[13px] leading-relaxed text-ink">
              {message.content}
            </div>
          </div>
        ) : (
          <div
            key={message.id}
            data-message-id={message.id}
            className="flex min-w-0 flex-col gap-4 text-[13px] leading-relaxed"
          >
            {message.content}
          </div>
        ),
      )}
    </div>
  );
}
