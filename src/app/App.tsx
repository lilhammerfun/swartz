import { useEffect, useRef, useState } from "react";
import { WindowBar } from "./WindowBar";
import SidebarNav from "../components/primitives/SidebarNav";
import PromptBar from "../components/primitives/PromptBar";
import ThinkingState from "../components/primitives/ThinkingState";
import { Button } from "../components/atoms/Button";
import { Network, BookOpen, Bell } from "../components/TukdamIcons";
import { Conversation } from "../features/chat/Conversation";
import { DecisionCard } from "../features/decisions/DecisionCard";
import { SupportPane } from "../features/workspace/SupportPane";
import { useWorkspace } from "../features/workspace/useWorkspace";
import type { Panel } from "../types/workspace";
import "../beautiful.css";
import "../theme.css";
import "./App.css";

export default function App() {
  const w = useWorkspace();
  const { state, active } = w;
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem("tukdam.theme") ??
      localStorage.getItem("tukdam.reference.theme") ??
      "light",
  );
  const [settings, setSettings] = useState(false);
  const [model, setModel] = useState("自定义模型");
  const later = state.deferredDecisionIds ?? [];
  const [sourceTarget, setSourceTarget] = useState<string | null>(null);
  const [paneWidth, setPaneWidth] = useState(420);
  useEffect(() => {
    if (active.messages.length === 0)
      document
        .querySelector<HTMLTextAreaElement>('textarea[aria-label="问题"]')
        ?.focus();
  }, [active.id]);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const workbench = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const wasSending = useRef(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("tukdam.theme", theme);
  }, [theme]);
  useEffect(() => {
    if (sourceTarget) {
      document
        .querySelector(`[data-message-id="${sourceTarget}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      setSourceTarget(null);
    } else scroll.current?.scrollTo({ top: 0 });
  }, [state.activeThreadId, sourceTarget]);
  useEffect(() => {
    if (wasSending.current)
      end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [active.messages.length, w.busy]);
  const project = state.projects.find((item) => item.key === active.projectId);
  const [tutorialTarget, setTutorialTarget] = useState<{
    id: string;
    chapterId?: string;
  } | null>(null);
  const pending = state.decisions.filter((item) => item.status !== "done");
  const activeRequest = state.decisions.find(
    (item) => item.threadId === active.id,
  );
  const open = (panel: Panel) => {
    if (panel === "tutorial") {
      const tutorial = state.tutorials.find(
        (item) => item.projectId === active.projectId,
      );
      setTutorialTarget(
        active.quote
          ? { id: active.quote.tutorialId, chapterId: active.quote.chapterId }
          : tutorial
            ? { id: tutorial.id }
            : null,
      );
    }
    w.edit({
      panel,
      collapsed: window.innerWidth < 1100 ? true : state.collapsed,
    });
  };
  const openProjectTutorial = (projectId: string) => {
    const thread = state.threads.find((item) => item.projectId === projectId);
    if (thread) w.select(thread.id);
    const tutorial = state.tutorials.find(
      (item) => item.projectId === projectId,
    );
    setTutorialTarget(tutorial ? { id: tutorial.id } : null);
    w.edit({
      panel: "tutorial",
      collapsed: window.innerWidth < 1100 ? true : state.collapsed,
    });
  };
  const source = (id: string, messageId: string) => {
    wasSending.current = false;
    w.select(id);
    setSourceTarget(messageId);
  };
  const send = (text: string) => {
    wasSending.current = true;
    w.send(text);
  };
  const resize = (width: number) =>
    setPaneWidth(
      Math.max(
        300,
        Math.min(
          width,
          Math.max(300, (workbench.current?.clientWidth ?? 1000) - 350),
        ),
      ),
    );
  return (
    <div className="app-shell">
      <WindowBar />
      <div className="workspace-shell" data-sidebar-collapsed={state.collapsed}>
        <SidebarNav
          projects={state.projects}
          threads={state.threads}
          activeId={active.id}
          activeProjectId={active.projectId}
          activeNav={state.panel}
          collapsed={state.collapsed}
          onCollapsedChange={(collapsed) => w.edit({ collapsed })}
          onOpenTutorial={openProjectTutorial}
          onNewChat={(projectId) => {
            wasSending.current = false;
            w.newChat(undefined, projectId);
          }}
          onPick={(id) => {
            wasSending.current = false;
            w.select(id);
          }}
          onNavigate={(key) => open(key as Panel)}
          onSettings={() => setSettings((value) => !value)}
          navItems={[
            { key: "map", label: "概念图", icon: <Network size={16} /> },
            { key: "tutorial", label: "教程", icon: <BookOpen size={16} /> },
            {
              key: "pending",
              label: "待处理",
              icon: <Bell size={16} />,
              count:
                pending.length +
                state.tutorials.filter(
                  (tutorial) => tutorial.status === "failed",
                ).length,
            },
          ]}
        />
        {settings && (
          <div className="settings-popover">
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setTheme((value) => (value === "light" ? "dark" : "light"));
                setSettings(false);
              }}
            >
              {theme === "light" ? "深色外观" : "浅色外观"}
            </Button>
          </div>
        )}
        <main className="workbench" ref={workbench}>
          <section className="chat-pane" aria-label="学习对话">
            <header className="content-toolbar">
              {active.projectId && (
                <>
                  <span className="breadcrumb">
                    {
                      state.projects.find(
                        (item) => item.key === active.projectId,
                      )?.label
                    }
                  </span>
                  <span className="breadcrumb">/</span>
                </>
              )}
              <h1>{active.label}</h1>
              {!active.projectId && activeRequest?.status === "waiting" && (
                <span className="processing-note">未归入项目</span>
              )}
            </header>
            {w.saveError && (
              <div className="save-notice" role="alert">
                <span>内容尚未保存。</span>
                <Button variant="quiet" size="xs" onClick={w.persist}>
                  重试保存
                </Button>
              </div>
            )}
            <div className="conversation-scroll" ref={scroll}>
              <div className="conversation-content">
                {active.quote && (
                  <blockquote className="quote-context">
                    <span>章节引用 · v{active.quote.version}</span>
                    <p>{active.quote.text}</p>
                    <Button
                      variant="quiet"
                      size="xs"
                      onClick={() => open("tutorial")}
                    >
                      打开教程
                    </Button>
                  </blockquote>
                )}
                <Conversation messages={active.messages} />
                {w.busy && <ThinkingState />}
                {activeRequest && !later.includes(activeRequest.id) && (
                  <DecisionCard
                    key={activeRequest.id}
                    request={activeRequest}
                    onConfirm={w.confirm}
                    onLater={() =>
                      w.edit({
                        deferredDecisionIds: [...later, activeRequest.id],
                      })
                    }
                  />
                )}
                {!w.busy && active.messages.at(-1)?.role === "user" && (
                  <div className="answer-retry">
                    <span>回答尚未完成。</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={w.retryAnswer}
                    >
                      重新回答
                    </Button>
                  </div>
                )}
                <div ref={end} />
              </div>
            </div>
            <div className="composer-container">
              <PromptBar
                draftValue={state.drafts[active.id] ?? ""}
                onDraftChange={(text) =>
                  w.edit({ drafts: { ...state.drafts, [active.id]: text } })
                }
                placeholder={
                  active.quote ? "针对这段引用提问…" : "输入想了解的问题…"
                }
                selectedModel={model}
                onModelChange={setModel}
                disabled={w.busy}
                onSend={send}
                onOpenTutorial={() => open("tutorial")}
              />
            </div>
          </section>
          {state.panel && (
            <>
              <div
                className="pane-resizer"
                role="separator"
                aria-label="调整辅助窗格宽度"
                aria-orientation="vertical"
                aria-valuenow={paneWidth}
                aria-valuemin={300}
                aria-valuemax={640}
                tabIndex={0}
                onPointerDown={(event) => {
                  drag.current = { x: event.clientX, width: paneWidth };
                  event.currentTarget.setPointerCapture(event.pointerId);
                  event.preventDefault();
                }}
                onPointerMove={(event) => {
                  if (drag.current)
                    resize(drag.current.width + drag.current.x - event.clientX);
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    resize(paneWidth + (event.key === "ArrowLeft" ? 20 : -20));
                  }
                }}
              />
              <div className="support-host" style={{ width: paneWidth }}>
                <SupportPane
                  panel={state.panel}
                  domain={
                    project &&
                    ["rust", "sql", "infra", "os"].includes(project.key)
                      ? project.domain
                      : null
                  }
                  hasProject={!!project}
                  tutorialTarget={tutorialTarget}
                  tutorials={
                    state.panel !== "tutorial" || !project || tutorialTarget
                      ? state.tutorials
                      : state.tutorials.filter(
                          (item) => item.projectId === project.key,
                        )
                  }
                  decisions={state.decisions}
                  onQuote={(quote) => {
                    wasSending.current = false;
                    w.newChat(quote);
                  }}
                  onSource={source}
                  onConfirm={w.confirm}
                  onLater={(id) => {
                    w.edit({ deferredDecisionIds: [...later, id] });
                    open(null);
                  }}
                  onRetry={w.retry}
                  onDiscuss={(text) => {
                    w.edit({ drafts: { ...state.drafts, [active.id]: text } });
                  }}
                  onClose={() => open(null)}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
