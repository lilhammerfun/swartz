import { TutorialPane } from "../tutorials/TutorialPane";
import { MapPane } from "../map/MapPane";
import { DecisionCard } from "../decisions/DecisionCard";
import { Button } from "../../components/atoms/Button";
import { X } from "../../components/TukdamIcons";
import type { Tutorial, Decision, Panel, Quote } from "../../types/workspace";

export function SupportPane({
  panel,
  domain,
  hasProject,
  tutorials,
  tutorialTarget,
  decisions,
  onQuote,
  onSource,
  onConfirm,
  onLater,
  onRetry,
  onDiscuss,
  onClose,
}: {
  panel: Exclude<Panel, null>;
  domain: string | null;
  hasProject: boolean;
  tutorialTarget: { id: string; chapterId?: string } | null;
  tutorials: Tutorial[];
  decisions: Decision[];
  onQuote: (quote: Quote) => void;
  onSource: (id: string, messageId: string) => void;
  onConfirm: (id: string, key: string, custom?: string) => void;
  onLater: (id: string) => void;
  onRetry: (id: string) => void;
  onDiscuss: (text: string) => void;
  onClose: () => void;
}) {
  const title = { map: "概念图", tutorial: "教程", pending: "待处理" }[panel];
  return (
    <aside className="support-pane" aria-label={title}>
      <header className="support-toolbar">
        <span>{title}</span>
        <Button
          variant="quiet"
          size="xs"
          className="icon-control"
          aria-label="关闭辅助窗格"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </header>
      <div className="support-content">
        {panel === "tutorial" && (
          <TutorialPane
            tutorials={tutorials}
            target={tutorialTarget}
            onQuote={onQuote}
            onSource={onSource}
            onRetry={onRetry}
          />
        )}
        {panel === "map" &&
          (domain ? (
            <MapPane
              key={domain}
              domain={domain}
              onSource={onSource}
              onDiscuss={onDiscuss}
            />
          ) : (
            <p className="pane-empty">
              {hasProject
                ? "还没有已整理的概念。"
                : "将会话归入项目后，在这里查看概念和理解证据。"}
            </p>
          ))}
        {panel === "pending" && (
          <div className="pending-list">
            {tutorials
              .filter((tutorial) => tutorial.status === "failed")
              .map((tutorial) => (
                <section className="pending-tutorial" key={tutorial.id}>
                  <span>教程更新未完成</span>
                  <strong>{tutorial.title}</strong>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRetry(tutorial.id)}
                  >
                    重试整理
                  </Button>
                </section>
              ))}
            {decisions
              .filter((item) => item.status !== "done")
              .map((request) => (
                <DecisionCard
                  key={request.id}
                  request={request}
                  onConfirm={onConfirm}
                  onLater={() => onLater(request.id)}
                />
              ))}
            {!decisions.some((item) => item.status !== "done") &&
              !tutorials.some((tutorial) => tutorial.status === "failed") && (
                <p className="pane-empty">没有待处理的事项。</p>
              )}
          </div>
        )}
      </div>
    </aside>
  );
}
