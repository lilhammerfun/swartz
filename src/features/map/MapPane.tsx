import { useState } from "react";
import { KnowledgeMap } from "./KnowledgeMap";
import { learningMaps } from "../../mock-data/workspace";
import { evidenceSeed } from "../../mock-data/product";
import { Button } from "../../components/atoms/Button";

export function MapPane({
  domain,
  onSource,
  onDiscuss,
}: {
  domain: string;
  onSource: (id: string, messageId: string) => void;
  onDiscuss: (text: string) => void;
}) {
  const map = learningMaps[domain];
  const [selected, setSelected] = useState(map.nodes[0].id);
  const node = map.nodes.find((item) => item.id === selected)!;
  const evidence = evidenceSeed.filter(
    (item) => item.domain === domain && item.conceptId === selected,
  );
  return (
    <div className="concept-pane">
      <KnowledgeMap
        map={map}
        selected={selected}
        onSelect={setSelected}
        onStart={() => onDiscuss(`我想进一步理解${node.label}。`)}
      />
      <section className="concept-details" aria-label="概念状态与证据">
        <h2>{node.label}</h2>
        <dl>
          <div>
            <dt>历史理解</dt>
            <dd>
              {node.mastery === null
                ? evidence.length
                  ? "待估计"
                  : "未知"
                : `${Math.round(node.mastery * 100)}% · 实验估计`}
            </dd>
          </div>
          <div>
            <dt>当前可用性</dt>
            <dd>待估计</dd>
          </div>
        </dl>
        {node.mastery !== null && (
          <p className="estimate-note">参数尚未校准，作为弱教学参考。</p>
        )}
        {evidence.length ? (
          evidence.map((item) => (
            <div className="concept-evidence" key={item.id}>
              <p>{item.text}</p>
              <span>{item.observedAt}</span>
              <Button
                variant="quiet"
                size="xs"
                onClick={() => onSource(item.threadId, item.messageId)}
              >
                查看原话
              </Button>
            </div>
          ))
        ) : (
          <p className="pane-empty">尚无有效理解证据。</p>
        )}
      </section>
    </div>
  );
}
