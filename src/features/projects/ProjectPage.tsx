import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlanMindmap } from "./PlanMindmap";
import { BookCover } from "@/features/library/BookCover";
import {
  recentActivities,
  type ProjectDetail,
  type ProjectActivity,
} from "./project-data";
import { projectError } from "./useProjects";

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
        <div className="project-summary">
          <header className="project-heading">
            <BookCover id={detail.project.id} title={detail.project.title} />
            <div>
              <h1>{detail.project.title}</h1>
              <p className="project-description whitespace-pre-wrap">
                {detail.goal.content || detail.project.description}
              </p>
              <Button
                className="project-start"
                variant="surface"
                onClick={() => {
                  setStartError("");
                  try {
                    onStart(detail);
                  } catch (cause) {
                    setStartError(projectError(cause));
                  }
                }}
              >
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
        <section className="project-section project-plan">
          {detail.plan.nodes.length ? (
            <PlanMindmap
              projectId={detail.project.id}
              title={detail.project.title}
              nodes={detail.plan.nodes}
              overview={detail.plan.overview}
            />
          ) : (
            <>
              <h2>Learning plan</h2>
              <p className="project-empty">No plan yet.</p>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
