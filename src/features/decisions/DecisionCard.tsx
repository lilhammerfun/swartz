import { useId, useState } from "react";
import { Button } from "../../components/atoms/Button";
import { SegmentedControl } from "../../components/atoms/SegmentedControl";
import { StatusPill } from "../../components/atoms/StatusPill";
import GlideMenu from "../../components/primitives/GlideMenu";
import type { Decision } from "../../types/workspace";

export function DecisionCard({
  request,
  onConfirm,
  onLater,
}: {
  request: Decision;
  onConfirm: (id: string, choice: string, custom?: string) => void;
  onLater?: () => void;
}) {
  const group = useId();
  const [mode, setMode] = useState<"创建项目" | "归入已有项目">("创建项目");
  const [choice, setChoice] = useState("");
  const [name, setName] = useState(request.proposedName);
  const duplicate = request.candidates.some(
    (candidate) =>
      candidate.label.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  );
  if (request.status === "done")
    return (
      <div className="decision-complete">
        <StatusPill tone="neutral" dot={false}>
          已归入 {request.selected}
        </StatusPill>
      </div>
    );
  return (
    <section className="decision-card" aria-label="项目归属">
      <h2>{request.question}</h2>
      <p>{request.reason}</p>
      <SegmentedControl
        options={["创建项目", "归入已有项目"] as const}
        value={mode}
        onChange={setMode}
      />
      {mode === "创建项目" ? (
        <div className="decision-create">
          <input
            className="decision-custom"
            aria-label="项目名称"
            placeholder="项目名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="decision-impact">
            {duplicate
              ? "同名项目已存在，可以归入已有项目。"
              : request.proposedScope}
          </p>
        </div>
      ) : (
        <GlideMenu
          className="decision-options"
          rowSelector="label"
          highlightClassName="inset-x-0 rounded-[8px] bg-hover-2"
        >
          {request.candidates.map((candidate) => (
            <label key={candidate.key} className="decision-option">
              <input
                type="radio"
                name={group}
                checked={choice === candidate.key}
                onChange={() => setChoice(candidate.key)}
              />
              <span>
                <strong>{candidate.label}</strong>
                <span>{candidate.scope}</span>
              </span>
            </label>
          ))}
          {!request.candidates.length && (
            <p className="decision-impact">还没有项目，可以先创建一个。</p>
          )}
        </GlideMenu>
      )}
      <footer>
        <Button variant="quiet" size="sm" onClick={onLater}>
          暂不处理
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={mode === "创建项目" ? !name.trim() || duplicate : !choice}
          onClick={() =>
            onConfirm(
              request.id,
              mode === "创建项目" ? "" : choice,
              mode === "创建项目" ? name : "",
            )
          }
        >
          {mode === "创建项目" ? "创建并归入" : "确认归入"}
        </Button>
      </footer>
    </section>
  );
}
