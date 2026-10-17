import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../atoms/Button";
import GlideMenu from "./GlideMenu";
import {
  PanelLeft,
  SquarePen,
  Search,
  X,
  SlidersHorizontal,
  Folder,
  ChevronDown,
  Plus,
  BookOpen,
} from "../TukdamIcons";
import type { Project, StudyThread } from "../../types/workspace";

export default function SidebarNav({
  projects,
  threads,
  activeId,
  activeProjectId,
  activeNav,
  collapsed,
  onCollapsedChange,
  onNewChat,
  onPick,
  onNavigate,
  onOpenTutorial,
  onSettings,
  navItems,
}: {
  projects: Project[];
  threads: StudyThread[];
  activeId: string;
  activeProjectId: string | null;
  activeNav: string | null;
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  onNewChat: (projectId?: string) => void;
  onPick: (id: string) => void;
  onNavigate: (key: string) => void;
  onOpenTutorial: (projectId: string) => void;
  onSettings: () => void;
  navItems: { key: string; label: string; icon: ReactNode; count?: number }[];
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>(
    activeProjectId ? [activeProjectId] : [],
  );
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen && !collapsed) search.current?.focus();
  }, [searchOpen, collapsed]);
  useEffect(() => {
    if (activeProjectId)
      setExpanded((ids) =>
        ids.includes(activeProjectId) ? ids : [...ids, activeProjectId],
      );
  }, [activeProjectId]);
  const matches = (label: string) =>
    label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const row = (
    key: string,
    label: string,
    icon: ReactNode,
    onClick: () => void,
    active = false,
    count?: number,
  ) => (
    <Button
      key={key}
      variant="quiet"
      size="xs"
      className={`sidebar-row ${active ? "is-active" : ""}`}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <span className="sidebar-row-icon">{icon}</span>
      <span className="sidebar-copy sidebar-row-copy">{label}</span>
      {!!count && <span className="sidebar-copy sidebar-count">{count}</span>}
    </Button>
  );
  const threadRow = (thread: StudyThread, nested = false) => (
    <Button
      key={thread.id}
      variant="quiet"
      size="xs"
      className={`sidebar-thread ${nested ? "is-nested" : ""} ${thread.id === activeId ? "is-active" : ""}`}
      aria-current={thread.id === activeId ? "page" : undefined}
      title={thread.label}
      onClick={() => onPick(thread.id)}
    >
      {thread.label}
    </Button>
  );
  const standalone = threads.filter(
    (thread) => !thread.projectId && matches(thread.label),
  );
  const visibleProjects = projects.filter(
    (project) =>
      matches(project.label) ||
      threads.some(
        (thread) => thread.projectId === project.key && matches(thread.label),
      ),
  );
  return (
    <aside
      className="product-sidebar"
      data-sidebar-collapsed={collapsed}
      aria-label="学习导航"
      style={{ width: collapsed ? 52 : 275 }}
    >
      <div className="sidebar-inner">
        <header className="sidebar-brand">
          <span className="sidebar-copy sidebar-brand-label">Tukdam</span>
          <Button
            variant="quiet"
            size="xs"
            className="sidebar-toggle"
            aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
            onClick={() => {
              onCollapsedChange(!collapsed);
              setSearchOpen(false);
            }}
          >
            <PanelLeft size={16} />
          </Button>
        </header>
        <div className="sidebar-domain-actions">
          {row("new", "新会话", <SquarePen size={16} />, () => onNewChat())}
          <Button
            variant="quiet"
            size="xs"
            className="sidebar-domain-search"
            aria-label="搜索会话"
            title="搜索会话"
            onClick={() => {
              onCollapsedChange(false);
              setSearchOpen(true);
            }}
          >
            <Search size={16} />
          </Button>
        </div>
        {searchOpen && !collapsed && (
          <div className="sidebar-domain-search-field">
            <Search size={15} />
            <input
              ref={search}
              aria-label="搜索会话"
              placeholder="搜索会话"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  setQuery("");
                }
              }}
            />
            <Button
              variant="quiet"
              size="xs"
              aria-label="关闭搜索"
              onClick={() => {
                setSearchOpen(false);
                setQuery("");
              }}
            >
              <X size={14} />
            </Button>
          </div>
        )}
        <GlideMenu
          className="sidebar-nav-items"
          rowSelector="button"
          highlightClassName="sidebar-glide-highlight rounded-[10px] bg-hover-2"
        >
          {collapsed &&
            row("projects", "项目", <Folder size={16} />, () =>
              onCollapsedChange(false),
            )}
          {navItems.map((item) =>
            row(
              item.key,
              item.label,
              item.icon,
              () => onNavigate(item.key),
              activeNav === item.key,
              item.count,
            ),
          )}
        </GlideMenu>
        <div
          className="sidebar-history"
          inert={collapsed}
          aria-hidden={collapsed}
        >
          <div className="sidebar-recent-label">项目</div>
          {visibleProjects.map((project) => {
            const children = threads.filter(
              (thread) =>
                thread.projectId === project.key &&
                (matches(project.label) || matches(thread.label)),
            );
            const isOpen = !!query.trim() || expanded.includes(project.key);
            return (
              <section className="sidebar-project" key={project.key}>
                <div
                  className={`sidebar-project-heading ${activeProjectId === project.key ? "is-current" : ""}`}
                >
                  <Button
                    variant="quiet"
                    size="xs"
                    className="sidebar-project-toggle"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setExpanded((ids) =>
                        ids.includes(project.key)
                          ? ids.filter((id) => id !== project.key)
                          : [...ids, project.key],
                      )
                    }
                  >
                    <span className="sidebar-project-symbol">
                      <Folder size={16} />
                      <ChevronDown
                        size={14}
                        className={isOpen ? "" : "is-closed"}
                      />
                    </span>
                    <span>{project.label}</span>
                  </Button>
                  <Button
                    variant="quiet"
                    size="xs"
                    className="sidebar-project-open-tutorial"
                    aria-label={`打开${project.label}的教程`}
                    title="教程"
                    onClick={() => onOpenTutorial(project.key)}
                  >
                    <BookOpen size={14} />
                  </Button>
                  <Button
                    variant="quiet"
                    size="xs"
                    className="sidebar-project-add"
                    aria-label={`在${project.label}中新建会话`}
                    title="新会话"
                    onClick={() => onNewChat(project.key)}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
                {isOpen && (
                  <GlideMenu
                    className="sidebar-project-threads"
                    rowSelector="button"
                    highlightClassName="sidebar-project-highlight rounded-[10px] bg-hover-2"
                  >
                    {children.map((thread) => threadRow(thread, true))}
                  </GlideMenu>
                )}
              </section>
            );
          })}
          {!!standalone.length && (
            <>
              <div className="sidebar-recent-label sidebar-standalone-label">
                会话
              </div>
              <GlideMenu
                rowSelector="button"
                highlightClassName="sidebar-glide-highlight rounded-[10px] bg-hover-2"
              >
                {standalone.map((thread) => threadRow(thread))}
              </GlideMenu>
            </>
          )}
          {query && !standalone.length && !visibleProjects.length && (
            <p className="sidebar-no-results">没有匹配的项目或会话</p>
          )}
        </div>
        <footer className="sidebar-footer">
          {row("settings", "设置", <SlidersHorizontal size={16} />, onSettings)}
        </footer>
      </div>
    </aside>
  );
}
