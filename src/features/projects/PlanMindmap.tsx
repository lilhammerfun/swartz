import { useEffect, useId, useRef, useState } from "react";
import {
  createIconElement,
  Fullscreen,
  Info,
  Maximize,
  Minimize,
  Minus,
  Plus,
} from "@/components/ui/icons";
import type { MindElixirInstance, NodeObj, Topic } from "mind-elixir";
import { RuntimeErrorNotice } from "@/components/ui/feedback";
import { IconButton } from "@/components/ui/IconButton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import { planMindmapData, type PlanMapMetadata } from "./plan-mindmap-data";
import type { PlanNode } from "./project-data";
import { organicMainBranch, organicSubBranch } from "./plan-mindmap-branches";
import { planMapFit } from "./plan-mindmap-fit";
import "mind-elixir/style.css";
import "./plan-mindmap.css";

const labels = {
  pending: "Not started",
  in_progress: "Exploring",
  completed: "Explored",
};
function statusIcon(status: NonNullable<PlanMapMetadata["status"]>) {
  return createIconElement(
    status === "completed"
      ? "check"
      : status === "in_progress"
        ? "circle-dot"
        : "circle",
  );
}

/** Read-only Plan view using Mind Elixir's two-sided layout, folding, and canvas controls without writeback. */
interface PlanMindmapProps {
  projectId: string;
  title: string;
  nodes: PlanNode[];
  overview: string;
}

export function PlanMindmap(props: PlanMindmapProps) {
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <div hidden={expanded}>
        <PlanMindmapView {...props} expanded={false} />
      </div>
      <DialogContent
        ref={dialog}
        className="plan-map-dialog"
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          dialog.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">
          {props.title} — Learning plan
        </DialogTitle>
        <PlanMindmapView {...props} expanded />
      </DialogContent>
    </Dialog>
  );
}

function PlanMindmapView({
  projectId,
  title,
  nodes,
  overview,
  expanded,
}: PlanMindmapProps & { expanded: boolean }) {
  const mapId = `plan-map-${encodeURIComponent(projectId)}-${useId()}`;
  const ExpandControl = expanded ? DialogClose : DialogTrigger;
  const [popoverContainer, setPopoverContainer] =
    useState<HTMLDivElement | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<MindElixirInstance | null>(null);
  const fit = useRef<() => void>(() => {});
  const [selected, setSelected] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = host.current!;
    let disposed = false;
    let mind: MindElixirInstance | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    setSelected(null);
    setError("");
    // Load after mounting so React Router SPA prerendering does not depend on document.
    void import("mind-elixir")
      .then(({ default: MindElixir }) => {
        if (disposed) return;
        mind = new MindElixir({
          el: element,
          direction: MindElixir.SIDE,
          editable: false,
          contextMenu: false,
          toolBar: false,
          keypress: false,
          allowUndo: false,
          overflowHidden: true,
          generateMainBranch: organicMainBranch,
          generateSubBranch: organicSubBranch,
          scaleMin: 0.05,
          alignment: "nodes",
          scaleMax: 1.5,
          handleWheel: (event) => {
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              mind!.scale(
                Math.max(
                  0.05,
                  Math.min(
                    1.5,
                    mind!.scaleVal - Math.sign(event.deltaY) * 0.08,
                  ),
                ),
              );
            }
          },
          theme: {
            name: "swartz",
            palette: [
              "#bd2653",
              "#1486a3",
              "#67a82e",
              "#d39316",
              "#6852ad",
              "#b83e8a",
              "#218e70",
              "#cb602c",
              "#457bbc",
              "#a05d3b",
            ],
            cssVar: {
              ...MindElixir.THEME.cssVar,
              "--bgcolor": "var(--background)",
              "--color": "var(--foreground)",
              "--main-color": "var(--foreground)",
              "--main-bgcolor": "transparent",
              "--main-bgcolor-transparent": "var(--muted)",
              "--root-color": "var(--foreground)",
              "--root-bgcolor": "var(--background)",
              "--root-border-color": "var(--border)",
              "--selected": "var(--ring)",
              "--accent-color": "var(--foreground)",
              "--node-gap-x": "36px",
              "--node-gap-y": "8px",
              "--main-gap-x": "64px",
              "--main-gap-y": "28px",
              "--topic-padding": "3px 8px",
              "--root-radius": "12px",
              "--main-radius": "0px",
              "--map-padding": "8px",
            },
          },
        });
        engine.current = mind;
        fit.current = () => {
          if (!mind || disposed) return;
          const fullscreen = expanded;
          const bounds = planMapFit(
            mind.nodes.offsetWidth,
            mind.nodes.offsetHeight,
            element.clientWidth,
            element.clientHeight,
            fullscreen,
          );
          if (!bounds) return;
          // Let the outer page scroll rather than constraining a long map to a fixed height.
          if (!fullscreen && element.style.height !== `${bounds.height}px`)
            element.style.height = `${bounds.height}px`;
          else if (fullscreen) element.style.removeProperty("height");
          mind.scale(bounds.scale);
          mind.toCenter();
        };
        const decorate = () => {
          let changed = false;
          for (const topic of element.querySelectorAll<Topic>("me-tpc")) {
            if (topic.dataset.planReady) continue;
            changed = true;
            topic.dataset.planReady = "true";
            const data = topic.nodeObj as NodeObj<PlanMapMetadata>;
            topic.setAttribute("role", "button");
            topic.tabIndex = 0;
            topic.setAttribute(
              "aria-label",
              data.metadata?.status
                ? `${data.topic}: ${labels[data.metadata.status]}`
                : data.topic,
            );
            if (data.metadata?.status) {
              topic.dataset.status = data.metadata.status;
              topic.prepend(statusIcon(data.metadata.status));
            }
            const expander = topic.nextElementSibling;
            if (expander?.tagName.toLowerCase() === "me-epd") {
              expander.setAttribute("role", "button");
              expander.setAttribute("tabindex", "0");
              expander.setAttribute("aria-label", `Collapse ${data.topic}`);
            }
          }
          for (const expander of element.querySelectorAll("me-epd")) {
            const topic = expander.previousElementSibling as Topic;
            const expanded = topic.nodeObj.expanded !== false;
            expander.setAttribute("aria-expanded", String(expanded));
            expander.setAttribute(
              "aria-label",
              `${expanded ? "Collapse" : "Expand"} ${topic.nodeObj.topic}`,
            );
          }
          return changed;
        };
        mind.bus.addListener("linkDiv", () => {
          // The library treats paths as uniform strokes; closed main branches need a matching fill.
          for (const path of element.querySelectorAll<SVGPathElement>(
            ".lines > path",
          )) {
            path.style.fill = path.getAttribute("stroke") ?? "currentColor";
            path.style.stroke = "none";
          }
          if (decorate()) {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => mind?.linkDiv());
          }
        });
        mind.bus.addListener("expandNode", () => {
          decorate();
          fit.current();
        });
        const failure = mind.init(planMindmapData(projectId, title, nodes));
        if (failure) throw failure;
        decorate();
        mind.linkDiv();
        fit.current();
        observer = new ResizeObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            fit.current();
          });
        });
        observer.observe(element);
      })
      .catch(() => {
        if (!disposed)
          setError(
            "The plan map could not be loaded. Reopen this project to try again.",
          );
      });
    const chooseTopic = (topic: Topic) => {
      for (const candidate of element.querySelectorAll("me-tpc")) {
        (candidate as HTMLElement).dataset.planSelected = String(
          candidate === topic,
        );
        candidate.removeAttribute("aria-describedby");
      }
      const data = topic.nodeObj;
      const metadata = data.metadata as PlanMapMetadata | undefined;
      if (metadata?.description)
        topic.setAttribute("aria-describedby", `${element.id}-description`);
      setSelected(
        metadata?.description
          ? { title: data.topic, description: metadata.description }
          : null,
      );
    };
    // Core read-only mode disables selection and expansion clicks; enable only the two reading actions needed here.
    const click = (event: MouseEvent) => {
      const target = (event.target as Element).closest("me-tpc, me-epd");
      if (!target) return;
      event.stopPropagation();
      if (target.tagName.toLowerCase() === "me-epd")
        mind?.expandNode(target.previousElementSibling as Topic);
      else chooseTopic(target as Topic);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target as HTMLElement;
      if (target.tagName.toLowerCase() === "me-tpc") {
        event.preventDefault();
        chooseTopic(target as Topic);
      } else if (target.tagName.toLowerCase() === "me-epd") {
        event.preventDefault();
        mind?.expandNode(target.previousElementSibling as Topic);
      }
    };
    element.addEventListener("keydown", keyboard);
    element.addEventListener("click", click, true);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      element.removeEventListener("keydown", keyboard);
      element.removeEventListener("click", click, true);
      mind?.destroy();
      engine.current = null;
      fit.current = () => {};
      element.style.removeProperty("height");
    };
  }, [projectId, title, nodes, expanded]);
  return (
    <div className="plan-mindmap" ref={setPopoverContainer}>
      <div className="plan-mindmap-toolbar">
        <div className="plan-mindmap-heading">
          <span className="section-meta">Plan connections</span>
          {overview && (
            <Popover>
              <PopoverTrigger asChild>
                <IconButton label="About this plan" size="icon-xs">
                  <Info />
                </IconButton>
              </PopoverTrigger>
              <PopoverContent
                container={popoverContainer}
                align="start"
                className="w-80 max-w-[calc(100vw-32px)]"
                aria-label="About this plan"
              >
                <PopoverHeader>
                  <PopoverTitle>About this plan</PopoverTitle>
                </PopoverHeader>
                <PopoverDescription className="whitespace-pre-wrap leading-6">
                  {overview}
                </PopoverDescription>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="plan-mindmap-controls">
          <IconButton
            label="Zoom out"
            onClick={() => {
              const mind = engine.current;
              if (mind) mind.scale(Math.max(0.05, mind.scaleVal - 0.1));
            }}
          >
            <Minus />
          </IconButton>
          <IconButton
            label="Zoom in"
            onClick={() => {
              const mind = engine.current;
              if (mind) mind.scale(Math.min(1.5, mind.scaleVal + 0.1));
            }}
          >
            <Plus />
          </IconButton>
          <IconButton label="Fit map" onClick={() => fit.current()}>
            <Maximize />
          </IconButton>
          <ExpandControl asChild>
            <IconButton label={expanded ? "Exit full screen" : "Full screen"}>
              {expanded ? <Minimize /> : <Fullscreen />}
            </IconButton>
          </ExpandControl>
        </div>
      </div>
      <div
        className="plan-mindmap-canvas"
        id={mapId}
        ref={host}
        aria-label="Plan mind map"
      />
      {error && (
        <RuntimeErrorNotice title="Could not display the plan map">
          {error}
        </RuntimeErrorNotice>
      )}
      <div
        id={`${mapId}-description`}
        className="plan-mindmap-description"
        aria-live="polite"
      >
        {selected && (
          <>
            <span>{selected.title}</span>
            <p>{selected.description}</p>
          </>
        )}
      </div>
    </div>
  );
}
