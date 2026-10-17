import { sidebarSections } from "./sidebar";
import { domainExamples } from "./learning";
import type { Thread, LearningMessage } from "../types/learning";
export const threads: Thread[] = sidebarSections.flatMap((section) =>
  section.items.map((item, i) => {
    const example = domainExamples[section.id];
    const mastery =
      i % 4 === 3 ? null : Math.round((0.32 + i * 0.07) * 100) / 100;
    const messages: LearningMessage[] = [
      {
        id: `${item.id}-1`,
        role: "user",
        text: `我想理解${item.label}。从一个具体例子开始吧。`,
      },
      {
        id: `${item.id}-2`,
        role: "assistant",
        blocks: [
          {
            kind: "answer",
            text: `先确定这次学习的起点。\n\n${example.intro}`,
          },
        ],
      },
      {
        id: `${item.id}-3`,
        role: "user",
        text: "能把输入、关键操作和输出分别说明吗？",
      },
      {
        id: `${item.id}-4`,
        role: "assistant",
        blocks: [
          { kind: "answer", text: example.intro },
          { kind: "code", filename: example.filename, lines: example.lines },
        ],
      },
      {
        id: `${item.id}-5`,
        role: "user",
        text: example.explanation,
      },
      {
        id: `${item.id}-6`,
        role: "assistant",
        blocks: [
          {
            kind: "answer",
            text: `这个判断区分了当前操作和后续可用性。${example.intro}`,
          },
        ],
      },
      {
        id: `${item.id}-7`,
        role: "user",
        text: "我还想换一个场景，确认不是记住了这个答案。",
      },
      {
        id: `${item.id}-8`,
        role: "assistant",
        blocks: [{ kind: "answer", text: example.explanation }],
      },
      {
        id: `${item.id}-9`,
        role: "user",
        text: "这段解释整理进教程后，我还能回到原对话吗？",
      },
      {
        id: `${item.id}-10`,
        role: "assistant",
        blocks: [
          {
            kind: "answer",
            text: "可以。章节保留讲解、代码和适用条件，并关联这段对话。阅读时选中一段内容，可以带着原文继续提问。",
          },
        ],
      },
    ];
    return {
      id: item.id,
      label: item.label,
      domain: section.id,
      focus: item.label,
      mastery,
      messages,
    };
  }),
);
export const defaultThread = threads[0];
export function replyFor(thread: Thread, id: string): LearningMessage {
  return {
    id,
    role: "assistant",
    blocks: [
      {
        kind: "answer",
        text: domainExamples[thread.domain].intro,
      },
      {
        kind: "code",
        filename: domainExamples[thread.domain].filename,
        lines: domainExamples[thread.domain].lines,
      },
    ],
  };
}
