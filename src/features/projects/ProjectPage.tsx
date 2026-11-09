import { useState } from "react";
import { RuntimeErrorNotice } from "@/components/ui/feedback";
import { ArrowRight, BookOpen } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { PageLayout, PageHeading } from "@/components/ui/page-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanMindmap } from "./PlanMindmap";
import { PlanOutline } from "./PlanOutline";
import {
  recentActivities,
  type ProjectDetail,
  type ProjectActivity,
} from "./project-data";
import { projectError } from "./useProjects";

const activityLabels: Record<ProjectActivity["kind"], string> = {
  goal_updated: "Goal",
  plan_updated: "Plan",
  textbook_revised: "Textbook",
};
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ProjectPage({
  detail,
  onStart,
  onRead,
}: {
  detail: ProjectDetail;
  onStart: (detail: ProjectDetail) => void;
  onRead: (detail: ProjectDetail) => void;
}) {
  const [startError, setStartError] = useState("");
  const chapters =
    detail.textbook?.chapters.filter((chapter) => chapter.sections.length) ??
    [];
  return (
    <PageLayout label="Project overview" className="project-page">
      <PageHeading
        title={detail.project.title}
        description={detail.project.description}
        actions={
          <Button
            variant="outline"
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
            <ArrowRight data-icon="inline-end" />
          </Button>
        }
      />
      {startError && (
        <RuntimeErrorNotice title="Could not start learning" className="mb-4">
          {startError}
        </RuntimeErrorNotice>
      )}
      <div className="project-overview-grid">
        <div className="project-main-column">
          <section
            className="project-section"
            aria-labelledby="project-goal-title"
          >
            <div className="section-heading">
              <h2 id="project-goal-title">Learning goal</h2>
            </div>
            <p className={detail.goal.content ? "project-goal" : "empty-copy"}>
              {detail.goal.content ||
                "Your goal can take shape as you explore. Start with a question."}
            </p>
          </section>
          <section className="project-section" aria-label="Learning plan">
            <Tabs defaultValue="outline">
              <div className="section-heading">
                <h2>Learning plan</h2>
                {!!detail.plan.nodes.length && (
                  <TabsList variant="line" aria-label="Plan view">
                    <TabsTrigger value="outline">Outline</TabsTrigger>
                    <TabsTrigger value="map">Map</TabsTrigger>
                  </TabsList>
                )}
              </div>
              {detail.plan.overview && (
                <p className="section-description">{detail.plan.overview}</p>
              )}
              <TabsContent value="outline">
                {detail.plan.nodes.length ? (
                  <>
                    <PlanOutline nodes={detail.plan.nodes} />
                    <p className="section-note">
                      Exploration status reflects your plan, not a measure of
                      mastery.
                    </p>
                  </>
                ) : (
                  <p className="empty-copy">
                    No plan yet. You can agree on a direction with your Tutor
                    when you’re ready.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="map">
                <PlanMindmap
                  projectId={detail.project.id}
                  title={detail.project.title}
                  nodes={detail.plan.nodes}
                  overview=""
                />
              </TabsContent>
            </Tabs>
          </section>
        </div>
        <div className="project-side-column">
          <section
            className="project-section"
            aria-labelledby="project-textbook-title"
          >
            <div className="section-heading">
              <h2 id="project-textbook-title">Textbook</h2>
              {!!chapters.length && (
                <span className="section-meta">
                  v{detail.textbook!.version}
                </span>
              )}
            </div>
            {chapters.length ? (
              <>
                <p className="textbook-title">{detail.textbook!.title}</p>
                <ol className="textbook-chapter-list">
                  {chapters.map((chapter, index) => (
                    <li key={chapter.id}>
                      <span className="section-meta">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{chapter.title}</span>
                    </li>
                  ))}
                </ol>
                <Button variant="outline" onClick={() => onRead(detail)}>
                  <BookOpen />
                  Open textbook
                </Button>
              </>
            ) : (
              <p className="empty-copy">
                No textbook yet. Ideas can become chapters when you choose to
                develop them.
              </p>
            )}
          </section>
          <section
            className="project-section"
            aria-labelledby="project-activity-title"
          >
            <div className="section-heading">
              <h2 id="project-activity-title">Recent changes</h2>
            </div>
            {detail.activities.length ? (
              <ol className="project-activities">
                {recentActivities(detail.activities).map((activity) => {
                  const date = new Date(activity.occurredAt);
                  return (
                    <li key={activity.id}>
                      <div className="project-activity-meta">
                        <span>{activityLabels[activity.kind]}</span>
                        <time dateTime={activity.occurredAt}>
                          {Number.isNaN(date.getTime())
                            ? activity.occurredAt
                            : dateFormat.format(date)}
                        </time>
                      </div>
                      <p>{activity.description}</p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="empty-copy">
                Confirmed goal, plan and textbook changes will appear here.
              </p>
            )}
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
