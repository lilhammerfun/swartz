import { useState } from "react";
import { Minus, Plus, Maximize2 } from "../../components/TukdamIcons";
import { Button } from "../../components/atoms/Button";
import { SegmentedControl } from "../../components/atoms/SegmentedControl";
import type { MapData } from "../../types/learning";
export function KnowledgeMap({
  map,
  selected,
  onSelect,
  onStart,
}: {
  map: MapData;
  selected: string;
  onSelect: (id: string) => void;
  onStart: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [filter, setFilter] = useState("all");
  return (
    <section className="map-pane">
      <div className="pane-heading">
        <div>
          <h2>知识地图</h2>
        </div>
        <Button
          variant="quiet"
          size="xs"
          className="icon-button"
          aria-label="重置地图缩放"
          onClick={() => setZoom(1)}
        >
          <Maximize2 size={16} />
        </Button>
      </div>
      <div className="map-filters">
        <SegmentedControl
          options={["全部概念", "正在理解", "尚未评估"] as const}
          value={
            filter === "unknown"
              ? "尚未评估"
              : filter === "learning"
                ? "正在理解"
                : "全部概念"
          }
          onChange={(value) =>
            setFilter(
              value === "尚未评估"
                ? "unknown"
                : value === "正在理解"
                  ? "learning"
                  : "all",
            )
          }
        />
      </div>
      <div className="map-scroll">
        <svg
          viewBox={`0 0 530 ${map.id === "rust" ? 720 : 500}`}
          style={{ width: `${100 * zoom}%`, minWidth: 440 }}
          role="img"
          aria-label={`${map.name}知识地图，点击节点选择教学上下文`}
        >
          <defs>
            <pattern
              id="dots"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r=".7" fill="var(--map-dot)" />
            </pattern>
            <marker
              id="arrow"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M0 0 L7 3.5 L0 7" fill="var(--edge)" />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
          {map.nodes.flatMap((n) =>
            n.prerequisites.map((id) => {
              const from = map.nodes.find((v) => v.id === id);
              if (!from) return null;
              const sx = from.x + 78,
                sy = from.y + 66,
                ex = n.x + 78,
                ey = n.y;
              return (
                <path
                  key={`${id}-${n.id}`}
                  d={`M${sx} ${sy} C${sx} ${sy + 32},${ex} ${ey - 32},${ex} ${ey - 8}`}
                  stroke={n.id === selected ? "var(--primary)" : "var(--edge)"}
                  strokeWidth={n.id === selected ? 1.8 : 1.2}
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              );
            }),
          )}
          {map.nodes.map((n) => {
            const dim =
              filter === "unknown"
                ? n.mastery !== null
                : filter === "learning"
                  ? n.mastery === null || n.mastery >= 0.7
                  : false;
            const chosen = n.id === selected;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                className={`map-node ${chosen ? "selected" : ""}`}
                opacity={dim ? 0.25 : 1}
                role="button"
                tabIndex={0}
                aria-label={`${n.label}，${n.mastery === null ? "尚未评估" : Math.round(n.mastery * 100) + "%"}${chosen ? "，已选择" : ""}`}
                onClick={() => onSelect(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(n.id);
                  }
                }}
              >
                <rect
                  width="156"
                  height="66"
                  rx="12"
                  fill={chosen ? "var(--selected-node)" : "var(--surface)"}
                  stroke={chosen ? "var(--primary)" : "var(--line-strong)"}
                  strokeWidth={chosen ? 1.6 : 1}
                />
                <circle
                  cx="17"
                  cy="21"
                  r="4"
                  fill={
                    n.mastery === null
                      ? "var(--ink-3)"
                      : n.mastery >= 0.7
                        ? "var(--mastery-known)"
                        : "var(--mastery-learning)"
                  }
                />
                <text x="29" y="25" className="node-label">
                  {n.label}
                </text>
                <text x="13" y="45" className="node-subtitle">
                  {n.mastery === null
                    ? "尚未评估"
                    : `${Math.round(n.mastery * 100)}% · 实验估计`}
                </text>
                <rect
                  x="110"
                  y="41"
                  width="32"
                  height="4"
                  rx="2"
                  fill="var(--line)"
                />
                {n.mastery !== null && (
                  <rect
                    x="110"
                    y="41"
                    width={32 * n.mastery}
                    height="4"
                    rx="2"
                    fill={
                      n.mastery >= 0.7
                        ? "var(--mastery-known)"
                        : "var(--mastery-learning)"
                    }
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="map-bottom">
        <div className="legend">
          <span>
            <i className="known" />
            较熟悉
          </span>
          <span>
            <i className="learning" />
            正在理解
          </span>
          <span>
            <i />
            尚未评估
          </span>
        </div>
        <div className="zoom-controls">
          <Button
            variant="quiet"
            size="xs"
            aria-label="缩小地图"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
          >
            <Minus size={14} />
          </Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button
            variant="quiet"
            size="xs"
            aria-label="放大地图"
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="map-learning-link"
        onClick={onStart}
      >
        在对话中继续
      </Button>
    </section>
  );
}
