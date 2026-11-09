import { useState } from "react";
import { Check, ChevronRight, Circle, CircleDot } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { PlanNode } from "./project-data";

const statuses = {
  pending: "Not started",
  in_progress: "Exploring",
  completed: "Explored",
};
function isExploring(node: PlanNode): boolean {
  return node.status === "in_progress" || node.children.some(isExploring);
}

function PlanBranch({ node }: { node: PlanNode }) {
  const [open, setOpen] = useState(() => isExploring(node));
  const Status =
    node.status === "completed"
      ? Check
      : node.status === "in_progress"
        ? CircleDot
        : Circle;
  return (
    <li className="plan-outline-node">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="navigation"
            className="plan-outline-trigger"
            aria-label={`${node.title}${node.status ? `: ${statuses[node.status]}` : ""}`}
          >
            {node.status && (
              <Status
                className="plan-outline-status"
                data-status={node.status}
              />
            )}
            <span>{node.title}</span>
            {node.status && (
              <span className="plan-status-label">{statuses[node.status]}</span>
            )}
            <ChevronRight className="plan-outline-chevron" data-open={open} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="plan-outline-detail">
          {node.description && <p>{node.description}</p>}
          {!!node.children.length && (
            <ol className="plan-outline-list">
              <PlanOutlineNodes nodes={node.children} />
            </ol>
          )}
          {!node.description && !node.children.length && (
            <p>No further detail yet.</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
function PlanOutlineNodes({ nodes }: { nodes: PlanNode[] }) {
  return nodes.map((node) => <PlanBranch key={node.id} node={node} />);
}
export function PlanOutline({ nodes }: { nodes: PlanNode[] }) {
  return (
    <ol className="plan-outline-list">
      <PlanOutlineNodes nodes={nodes} />
    </ol>
  );
}
