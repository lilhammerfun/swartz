import type { MindElixirData, NodeObj } from "mind-elixir";
import type { ExplorationStatus, PlanNode } from "./project-data.ts";

export interface PlanMapMetadata {
  description: string;
  status: ExplorationStatus | null;
}

/** The graph library adds fields such as parent and expanded; give it an isolated presentation copy. */
export function planMindmapData(
  projectId: string,
  title: string,
  nodes: readonly PlanNode[],
): MindElixirData {
  const copy = (node: PlanNode): NodeObj<PlanMapMetadata> => ({
    id: `plan:${encodeURIComponent(node.id)}`,
    topic: node.title,
    metadata: { description: node.description, status: node.status },
    expanded: true,
    ...(node.children.length ? { children: node.children.map(copy) } : {}),
  });
  return {
    nodeData: {
      id: `root:${encodeURIComponent(projectId)}`,
      topic: title,
      children: nodes.map(copy),
    },
    direction: 2,
  };
}
