import { useState } from "react";
import { Button } from "../atoms/Button";
import GlideMenu from "./GlideMenu";
/** Beautiful UI approval surface. Submission is always an explicit action. */
export default function ApprovalCard({
  questions,
  labels,
  onSubmitted,
}: {
  questions: { q: string; type: "radio"; options: string[] }[];
  labels: {
    skip: string;
    send: string;
    customPlaceholder: string;
    sentMessage: string;
  };
  onSubmitted: (answers: Record<number, number[]>) => void;
}) {
  const [option, setOption] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [sent, setSent] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const question = questions[0];
  if (!question || skipped) return null;
  if (sent)
    return <p className="text-[12px] text-ink-3">{labels.sentMessage}</p>;
  return (
    <section className="rounded-card bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-[14px] font-medium text-ink">{question.q}</h2>
      <GlideMenu
        rowSelector="label"
        highlightClassName="inset-x-0 rounded-[7px] bg-hover-2"
      >
        {question.options.map((text, index) => (
          <label
            key={text}
            className="relative z-10 flex items-center gap-2.5 rounded-[7px] px-2 py-2 text-[13px] text-ink-2"
          >
            <input
              type="radio"
              name={question.q}
              checked={option === index}
              onChange={() => setOption(index)}
            />
            <span>{text}</span>
          </label>
        ))}
      </GlideMenu>
      <input
        aria-label="补充解释"
        placeholder={labels.customPlaceholder}
        className="mt-3 w-full rounded-[7px] border border-line bg-field px-3 py-2 text-[12px] text-ink"
        value={custom}
        onChange={(event) => setCustom(event.target.value)}
      />
      <footer className="mt-4 flex justify-end gap-2">
        <Button variant="quiet" size="sm" onClick={() => setSkipped(true)}>
          {labels.skip}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={option === null && !custom.trim()}
          onClick={() => {
            onSubmitted({ 0: option === null ? [] : [option] });
            setSent(true);
          }}
        >
          {labels.send}
        </Button>
      </footer>
    </section>
  );
}
