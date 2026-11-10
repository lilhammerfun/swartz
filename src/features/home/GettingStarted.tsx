import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "@/components/ui/icons";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Project, ProjectDetail } from "@/features/projects/project-data";
import type { ReaderLocation } from "@/types/book";

/** Completion is derived from saved learning data, checked when the helper menu opens. */
export function GettingStarted({
  configured,
  projects,
  details,
  loading,
  loadDetail,
  onNavigate,
}: {
  configured: boolean;
  projects: Project[];
  details: Record<string, ProjectDetail>;
  loading: boolean;
  loadDetail: (id: string) => Promise<ProjectDetail>;
  onNavigate: (location: ReaderLocation) => void;
}) {
  const [scanned, setScanned] = useState<ProjectDetail[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const chapterExists = (detail: ProjectDetail) =>
    detail.textbook?.chapters.some((chapter) =>
      chapter.sections.some((section) =>
        section.paragraphs.some((p) => p.text.trim().length > 0),
      ),
    ) ?? false;

  useEffect(() => {
    let active = true;
    setReady(false);
    setFailed(false);
    // Reuse the detail cache and stop once a plan and textbook are found; do not prefetch the whole Library.
    void (async () => {
      const found: ProjectDetail[] = [];
      let hadFailure = false;
      for (const project of projects) {
        try {
          found.push(await loadDetail(project.id));
        } catch {
          hadFailure = true;
        }
        if (!active) return;
        if (
          found.some((d) => d.plan.nodes.length > 0) &&
          found.some(chapterExists)
        )
          break;
      }
      if (active) {
        setScanned(found);
        setFailed(hadFailure);
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [projects, loadDetail, attempt]);

  const available = projects.flatMap((project) => {
    const detail =
      details[project.id] ?? scanned.find((d) => d.project.id === project.id);
    return detail ? [detail] : [];
  });
  const hasPlan = available.some((d) => d.plan.nodes.length > 0);
  const hasChapter = available.some(chapterExists);
  const projectDestination = (detail?: ProjectDetail): ReaderLocation => {
    const target = detail?.project ?? projects[0];
    return target
      ? { scale: "project", projectId: target.id }
      : { scale: "home" };
  };
  const steps = [
    {
      id: "model",
      label: "Connect a model",
      done: configured,
      destination: { scale: "settings" } as ReaderLocation,
    },
    {
      id: "project",
      label: "Start your first project",
      done: projects.length > 0,
      destination: { scale: "home" } as ReaderLocation,
    },
    {
      id: "plan",
      label: "Shape your plan",
      done: hasPlan,
      destination: projectDestination(
        available.find((d) => !d.plan.nodes.length),
      ),
    },
    {
      id: "chapter",
      label: "Create your first chapter",
      done: hasChapter,
      destination: projectDestination(available.find((d) => !chapterExists(d))),
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  return (
    <>
      <DropdownMenuLabel>
        Getting started · {completed}/{steps.length}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {steps.map((step) => (
        <DropdownMenuItem
          key={step.id}
          onSelect={() => onNavigate(step.destination)}
        >
          {step.done ? (
            <CheckCircle2 className="text-muted-foreground" />
          ) : (
            <Circle className="text-muted-foreground" />
          )}
          <span className={step.done ? "text-muted-foreground" : undefined}>
            {step.label}
          </span>
        </DropdownMenuItem>
      ))}
      {(loading || !ready) && (
        <DropdownMenuLabel>Checking progress…</DropdownMenuLabel>
      )}
      {failed && (
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setAttempt((value) => value + 1);
          }}
        >
          Retry progress check
        </DropdownMenuItem>
      )}
    </>
  );
}
