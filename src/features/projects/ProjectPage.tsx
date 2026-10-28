import { useState } from "react";
import { ArrowRight, Check, Circle, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/features/library/BookCover";
import {
  recentActivities,
  type PlanNode,
  type ProjectDetail,
  type ProjectActivity,
} from "./project-data";
import { projectError } from "./useProjects";

const statusLabels = {
  pending: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};
const activityLabels: Record<ProjectActivity["kind"], string> = {
  goal_updated: "Goal updated",
  plan_updated: "Plan updated",
  textbook_revised: "Textbook revised",
};
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function PlanTree({ nodes }: { nodes: PlanNode[] }) {
  return (
    <ul className="project-plan-tree">
      {nodes.map((node) => {
        const icon =
          node.status === "completed" ? (
            <Check />
          ) : node.status === "in_progress" ? (
            <CircleDot />
          ) : (
            <Circle />
          );
        const content = (
          <>
            <span className="project-node-title">{node.title}</span>
            {node.status && (
              <span className="project-node-status">
                {statusLabels[node.status]}
              </span>
            )}
          </>
        );
        return (
          <li key={node.id}>
            {node.children.length ? (
              <details open>
                <summary>{content}</summary>
                {node.description && (
                  <p className="project-node-description">{node.description}</p>
                )}
                <PlanTree nodes={node.children} />
              </details>
            ) : (
              <div className="project-plan-leaf">
                <span className="project-node-icon" aria-hidden="true">
                  {icon}
                </span>
                <div className="project-node-body">
                  <div className="project-node-row">{content}</div>
                  {node.description && (
                    <p className="project-node-description">
                      {node.description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ProjectPage({
  detail,
  onStart,
}: {
  detail: ProjectDetail;
  onStart: (detail: ProjectDetail) => void;
}) {
  const [startError, setStartError] = useState("");

  return (
    <section className="project-page-scroll" aria-label="Project details">
      <div className="project-page">
        <header className="project-heading">
          <BookCover id={detail.project.id} title={detail.project.title} />
          <div>
            <p className="project-eyebrow">Project</p>
            <h1>{detail.project.title}</h1>
            <p className="project-description">{detail.project.description}</p>
            <Button
              className="project-start"
              onClick={() => {
                setStartError("");
                try {
                  onStart(detail);
                } catch (cause) {
                  setStartError(projectError(cause));
                }
              }}
            >
              <ArrowRight />
              Start learning
            </Button>
            {startError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {startError}
              </p>
            )}
          </div>
        </header>
        <section className="project-section">
          <h2>Goal</h2>
          <p className="project-goal">
            {detail.goal.content || "Start a conversation to define your goal."}
          </p>
        </section>
        <section className="project-section">
          <h2>Plan</h2>
          {detail.plan.overview && (
            <p className="project-plan-overview">{detail.plan.overview}</p>
          )}
          {detail.plan.nodes.length ? (
            <PlanTree nodes={detail.plan.nodes} />
          ) : (
            <p className="project-empty">No plan yet.</p>
          )}
        </section>
        <section className="project-section">
          <h2>Recent activity</h2>
          {detail.activities.length ? (
            <ol className="project-activities">
              {recentActivities(detail.activities).map((activity) => {
                const date = new Date(activity.occurredAt);
                return (
                  <li key={activity.id}>
                    <p>{activity.description}</p>
                    <div className="project-activity-meta">
                      <time dateTime={activity.occurredAt}>
                        {Number.isNaN(date.getTime())
                          ? activity.occurredAt
                          : dateFormat.format(date)}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span>{activityLabels[activity.kind]}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="project-empty">No activity yet.</p>
          )}
        </section>
      </div>
    </section>
  );
}
