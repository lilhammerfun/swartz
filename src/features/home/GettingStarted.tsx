import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import type { Project, ProjectDetail } from "@/features/projects/project-data";
import type { ReaderLocation } from "@/types/book";

const preferenceKey = "swartz.getting-started.v1";
type Preferences = { open?: boolean; hidden?: boolean };
function loadPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}");
    return {
      open: typeof value.open === "boolean" ? value.open : undefined,
      hidden: value.hidden === true,
    };
  } catch {
    return {};
  }
}

/** 完成状态读取业务数据；只有展开、隐藏偏好属于这张引导卡片。 */
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
  const [preferences, setPreferences] = useState(loadPreferences);
  const [scanned, setScanned] = useState<ProjectDetail[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { isMobile, setOpenMobile } = useSidebar();
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
    // 复用项目详情缓存；一旦找到计划和教材即停止，不为卡片预取整个 Library。
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
  const allDone = completed === steps.length;
  const [wasComplete, setWasComplete] = useState(false);
  useEffect(() => {
    if (allDone && !wasComplete)
      setPreferences((current) => ({ ...current, open: false }));
    setWasComplete(allDone);
  }, [allDone, wasComplete]);

  const updatePreferences = (next: Preferences) => {
    setPreferences(next);
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(next));
    } catch {
      /* 偏好无法落盘时，本次会话仍可正常折叠和隐藏。 */
    }
  };
  if (loading || !ready) return null;
  if (preferences.hidden)
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => updatePreferences({ hidden: false, open: true })}
      >
        Getting started
      </Button>
    );
  return (
    <Collapsible
      open={preferences.open ?? !allDone}
      onOpenChange={(open) => updatePreferences({ ...preferences, open })}
      asChild
    >
      <Card size="sm" aria-label="Getting started" className="gap-1">
        <CardHeader>
          <CardTitle>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto min-h-7 justify-start gap-2 px-0 text-left"
              >
                <span>Getting started</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {completed} of {steps.length}
                </span>
                <ChevronDown
                  data-icon="inline-end"
                  className="ml-auto transition-transform in-data-[state=closed]:-rotate-90"
                />
              </Button>
            </CollapsibleTrigger>
          </CardTitle>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Getting started options"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onSelect={() =>
                      updatePreferences({ ...preferences, hidden: true })
                    }
                  >
                    Hide checklist
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="px-1">
            <ItemGroup className="gap-0">
              {steps.map((step) => (
                <Item key={step.id} size="xs" asChild>
                  <Button
                    variant="ghost"
                    className="h-auto justify-start whitespace-normal text-left font-normal"
                    onClick={() => {
                      onNavigate(step.destination);
                      if (isMobile) setOpenMobile(false);
                    }}
                    aria-label={`${step.label}${step.done ? ": Completed" : ""}`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="text-muted-foreground" />
                    ) : (
                      <Circle className="text-muted-foreground" />
                    )}
                    <ItemContent className="min-w-0">
                      <span
                        className={
                          step.done ? "text-muted-foreground line-through" : ""
                        }
                      >
                        {step.label}
                      </span>
                    </ItemContent>
                  </Button>
                </Item>
              ))}
            </ItemGroup>
            {failed && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Retry progress check
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
