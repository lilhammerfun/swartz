import { useState } from "react";
import ChatComposer from "../../components/primitives/ChatComposer";
import StreamingText from "../../components/primitives/StreamingText";
import CodeBlock from "../../components/primitives/CodeBlock";
import ApprovalCard from "../../components/primitives/ApprovalCard";
import { StatusPill } from "../../components/atoms/StatusPill";
import type { LearningBlock, LearningMessage } from "../../types/learning";
export function Question({
  block,
}: {
  block: Extract<LearningBlock, { kind: "question" }>;
}) {
  const [answer, setAnswer] = useState<number | null>(null);
  return (
    <>
      <ApprovalCard
        questions={[{ q: block.prompt, type: "radio", options: block.options }]}
        labels={{
          skip: "跳过",
          send: "提交回答",
          customPlaceholder: "用自己的话补充…",
          sentMessage: "已提交",
        }}
        onSubmitted={(answers) => setAnswer(answers[0]?.[0] ?? null)}
      />
      {answer !== null && (
        <div className="space-y-2">
          <StatusPill
            tone={answer === block.correct ? "green" : "orange"}
            dot={false}
          >
            {answer === block.correct ? "判断正确" : "回看判断依据"}
          </StatusPill>
          <StreamingText content={[{ text: block.explanation }]} />
        </div>
      )}
    </>
  );
}
function Block({ block }: { block: LearningBlock }) {
  switch (block.kind) {
    case "answer":
      return (
        <StreamingText
          content={block.text
            .split(/(?<=。|：|\n)/)
            .filter(Boolean)
            .map((text) => ({ text }))}
        />
      );
    case "code":
      return (
        <CodeBlock
          filename={block.filename}
          lines={block.lines}
          labels={{ copy: "复制代码", copied: "已复制" }}
        />
      );
    case "question":
      return <Question block={block} />;
  }
}
export function Conversation({ messages }: { messages: LearningMessage[] }) {
  return (
    <ChatComposer
      className="product-conversation"
      history={messages.map((message) => ({
        id: message.id,
        role: message.role,
        content:
          message.role === "user" ? (
            message.text
          ) : (
            <>
              {message.blocks?.map((block, i) => (
                <Block key={`${message.id}-${i}`} block={block} />
              ))}
            </>
          ),
      }))}
    />
  );
}
