import {
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
  useNavigation,
  useNavigationType,
  useRevalidator,
} from "react-router";
import { locationPath, type ReaderRouteHandle } from "./route-location";
import type { AppRouteContext } from "./app-route-context";
import { RouteLoading } from "./RouteFeedback";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  MessagesSquare,
  Maximize2,
  Minus,
  PanelRight,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { IconButton } from "@/components/ui/IconButton";
import {
  LibrarySectionDialog,
  type SectionAction,
} from "@/features/library/LibrarySectionDialog";
import { LibrarySidebar } from "@/features/library/LibrarySidebar";
import { GettingStarted } from "@/features/home/GettingStarted";
import { useLibrary } from "@/features/library/useLibrary";
import { useProjects } from "@/features/projects/useProjects";
import {
  projectBook,
  type ProjectDetail,
} from "@/features/projects/project-data";
import { ReaderSplit } from "@/features/reader/ReaderSplit";
import { SessionPanel } from "@/features/chat/SessionPanel";
import { useSessionPanel } from "@/features/chat/useSessionPanel";
import { sessionPassages } from "@/features/chat/session-passages";
import type { ChatSession } from "@/features/chat/chat-store";
import { useChat } from "@/features/chat/useChat";
import { useBookIntegrations } from "@/features/chat/useBookIntegrations";
import { UndoToasts, type UndoNotice } from "@/components/ui/undo-toast";
import {
  sessionIsSynthesized,
  visibleMessages,
} from "@/features/chat/book-integration";
import {
  loadRecentLearning,
  recordRecentLearning,
  latestReadingLocations,
  RECENT_LEARNING_STORAGE_KEY,
  type RecentLearningEntry,
} from "@/features/home/recent-learning";
import { SidebarReopenButton } from "./SidebarReopenButton";
import type { AnnotationSelection } from "@/features/annotations/annotation-selection";
import {
  defaultModelSettings,
  modelIsConfigured,
  type ModelSettings,
  type ModelConfig,
} from "@/features/model/model-api";
import {
  loadModelSettings,
  saveModelSettings,
} from "@/features/model/model-service";
import {
  promptChoices,
  type PromptSubmission,
} from "@/features/annotations/prompt-options";
import { initialLocation, learningBook as starterBook } from "@/mock-data/book";
import type {
  Annotation,
  AnnotationAnchor,
  ReaderLocation,
  LearningBook,
} from "@/types/book";

const ChatPage = lazy(() =>
  import("@/features/chat/ChatPage").then((module) => ({
    default: module.ChatPage,
  })),
);

function loadRecent() {
  try {
    return { entries: loadRecentLearning(localStorage), error: "" };
  } catch {
    return {
      entries: [] as RecentLearningEntry[],
      error:
        "Recent learning could not be loaded. Your saved data has not been changed.",
    };
  }
}

export default function App() {
  const [sectionAction, setSectionAction] = useState<SectionAction | null>(
    null,
  );
  const [selectingProjects, setSelectingProjects] = useState(false);
  const revalidator = useRevalidator();
  const routerLocation = useLocation();
  const routerNavigate = useNavigate();
  const navigation = useNavigation();
  const navigationType = useNavigationType();
  const matches = useMatches();
  // 继续兼容旧阅读位置数据；页面匹配来自 Router 的实际匹配结果。
  const location = useMemo<ReaderLocation>(() => {
    const match = [...matches]
      .reverse()
      .find(
        (match) =>
          (match.handle as ReaderRouteHandle | undefined)?.readerLocation,
      );
    return match
      ? (match.handle as ReaderRouteHandle).readerLocation(match.params)
      : { scale: "home" };
    // 数据重验证不改变页面位置，保留异步操作用于判定用户是否已离开的身份。
  }, [routerLocation.pathname]);
  const routeBook = matches
    .map(
      (match) =>
        (match.loaderData as { book?: LearningBook } | undefined)?.book,
    )
    .find(Boolean);
  const historyIndex =
    typeof window.history.state?.idx === "number"
      ? (window.history.state.idx as number)
      : 0;
  // 只跟踪标题栏按钮可用性；实际历史、跳转和 POP 行为由 Router 管理。
  const [lastHistoryIndex, setLastHistoryIndex] = useState(historyIndex);
  useEffect(() => {
    // POP 导航等待 loader 时，浏览器索引已改变，Router 的旧页面尚未提交。
    // 只在 location 提交后更新按钮边界，不能把等待期间的索引当作新的 PUSH。
    const committedIndex =
      typeof window.history.state?.idx === "number"
        ? (window.history.state.idx as number)
        : 0;
    setLastHistoryIndex((current) =>
      navigationType === "PUSH"
        ? committedIndex
        : Math.max(current, committedIndex),
    );
  }, [routerLocation.key, navigationType]);
  const storedLibrary = useLibrary(starterBook);
  const projects = useProjects();
  const integrations = useBookIntegrations();
  // Project 的详情进入现有阅读器；保留旧书数据以兼容原有会话和引用。
  const projectBooks = projects.projects.map((project) =>
    projectBook(project, projects.details[project.id]),
  );
  const library = {
    ...storedLibrary,
    books: [
      ...storedLibrary.books.filter(
        (item) => !projects.projects.some((project) => project.id === item.id),
      ),
      ...projectBooks,
    ]
      .concat(
        routeBook &&
          !storedLibrary.books.some((item) => item.id === routeBook.id) &&
          !projects.projects.some((item) => item.id === routeBook.id)
          ? [routeBook]
          : [],
      )
      .map((item) =>
        integrations.project(routeBook?.id === item.id ? routeBook : item),
      ),
  };
  const storedChat = useChat();
  const chat = {
    ...storedChat,
    sessions: storedChat.sessions.filter(
      (session) => !sessionIsSynthesized(session, integrations.entries),
    ),
    getSession: (id: string) => {
      const session = storedChat.getSession(id);
      return session && !sessionIsSynthesized(session, integrations.entries)
        ? session
        : undefined;
    },
  };
  const [recent, setRecent] = useState(loadRecent);
  const [undoNotices, setUndoNotices] = useState<UndoNotice[]>([]);
  const [sessionPanelWidth, setSessionPanelWidth] = useState<number>();
  const [sessionToolbar, setSessionToolbar] = useState<HTMLDivElement | null>(
    null,
  );
  const [modelSettings, setModelSettings] =
    useState<ModelSettings>(defaultModelSettings);
  const [modelLoadError, setModelLoadError] = useState("");
  const configured = modelIsConfigured(modelSettings);
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);
  useEffect(() => {
    let active = true;
    void loadModelSettings()
      .then((value) => {
        if (active) setModelSettings(value);
      })
      .catch((error) => {
        if (active)
          setModelLoadError(
            typeof error === "string"
              ? error
              : "Could not load model settings.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const saveModel = async (input: ModelConfig) => {
    const value = await saveModelSettings(input);
    setModelSettings(value);
    setModelLoadError("");
  };
  const readingLocation = useRef<ReaderLocation>(
    Object.values(latestReadingLocations(recent.entries))[0] ?? initialLocation,
  );
  const readingLocations = useRef<Record<string, ReaderLocation>>({
    [starterBook.id]: initialLocation,
    ...latestReadingLocations(recent.entries),
  });
  useEffect(() => {
    if (location.scale === "section" || location.scale === "book") {
      readingLocation.current = location;
      readingLocations.current[location.bookId] = location;
    }
  }, [location]);
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
  const [annotationFocusRequest, setAnnotationFocusRequest] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentBookLocation =
    location.scale === "section" || location.scale === "book"
      ? location
      : readingLocation.current;
  const routeChatSession =
    location.scale === "chat"
      ? chat.getSession(location.conversationId)
      : undefined;
  const book =
    library.books.find(
      (item) =>
        item.id ===
        (location.scale === "chat"
          ? routeChatSession?.bookId
          : "bookId" in currentBookLocation
            ? currentBookLocation.bookId
            : undefined),
    ) ?? starterBook;
  const chapter =
    book.chapters.find(
      (c) => location.scale === "section" && c.id === location.chapterId,
    ) ?? book.chapters[0];
  const section =
    chapter?.sections.find(
      (s) => location.scale === "section" && s.id === location.sectionId,
    ) ?? chapter?.sections[0];
  const inBook = location.scale === "section" || location.scale === "book";
  const panel = useSessionPanel(book.id);
  const panelVisible = inBook && panel.open;
  const chatSession =
    location.scale === "chat"
      ? routeChatSession
      : inBook
        ? chat.getSession(panel.active)
        : undefined;
  const notes = sessionPassages(
    chat.sessions.map((session) => ({
      ...session,
      messages: visibleMessages(session, integrations.entries),
    })),
  );
  const [messageFocus, setMessageFocus] = useState<{
    id: string;
    request: number;
  }>();
  const recordedLocation = useRef<ReaderLocation | null>(null);
  useEffect(() => {
    const readingChanged = recordedLocation.current !== location;
    recordedLocation.current = location;
    // Hiding the overlay is not a new reading visit. Keep its conversation resumable.
    if (!readingChanged && !chatSession?.messages.length) return;
    if (
      location.scale !== "book" &&
      location.scale !== "section" &&
      !(chatSession && chatSession.messages.length > 0)
    )
      return;
    try {
      const entries = recordRecentLearning(
        localStorage,
        (chatSession?.messages.length
          ? { scale: "chat", conversationId: chatSession.id }
          : location) as Extract<
          ReaderLocation,
          { scale: "book" | "section" | "chat" }
        >,
        chatSession?.bookId,
      );
      setRecent({ entries, error: "" });
    } catch {
      setRecent((previous) => ({
        ...previous,
        error:
          "Recent learning could not be saved. Your previous history has been kept.",
      }));
    }
  }, [
    location,
    chatSession?.id,
    chatSession?.messages.length,
    chatSession?.bookId,
  ]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === RECENT_LEARNING_STORAGE_KEY || event.key === null) {
        const next = loadRecent();
        setRecent(next);
        readingLocations.current = {
          ...readingLocations.current,
          ...latestReadingLocations(next.entries),
        };
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4200);
  };
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const navigate = (next: ReaderLocation) => {
    void routerNavigate(locationPath(next));
    setActiveAnnotation(null);
    setSearchOpen(false);
  };
  const navigateToBook = (target: LearningBook) => {
    const previous = readingLocations.current[target.id];
    if (
      previous?.scale === "book" ||
      (previous?.scale === "section" &&
        target.chapters.some(
          (c) =>
            c.id === previous.chapterId &&
            c.sections.some((s) => s.id === previous.sectionId),
        ))
    )
      return navigate(previous);
    const firstChapter = target.chapters.find(
      (item) => item.sections.length > 0,
    );
    navigate(
      firstChapter
        ? {
            scale: "section",
            bookId: target.id,
            chapterId: firstChapter.id,
            sectionId: firstChapter.sections[0].id,
          }
        : { scale: "book", bookId: target.id },
    );
  };
  const openBook = (target: LearningBook) => {
    const project = projects.projects.find((item) => item.id === target.id);
    if (!project) return navigateToBook(target);
    const cached = projects.getCached(project.id);
    if (cached)
      return navigateToBook(integrations.project(projectBook(project, cached)));
    const origin = locationRef.current;
    void projects
      .loadDetail(project.id)
      .then((detail) => {
        // 读取期间用户已切换页面时，不让晚到响应把页面拉回。
        if (locationRef.current === origin)
          navigateToBook(integrations.project(projectBook(project, detail)));
      })
      .catch(() =>
        showNotice("Could not open this project. Please try again."),
      );
  };
  const startProject = (detail: ProjectDetail) => {
    const target = integrations.project(projectBook(detail.project, detail));
    const sessionId = chat.startSession(target);
    if (!sessionId)
      throw new Error(
        "Could not open the learning session. Check local storage and try again.",
      );
    navigateToBook(target);
    panel.openSession(sessionId, target.id);
  };
  const openSavedConversation = (id: string) => {
    const session = chat.getSession(id);
    if (!session) return;
    const target = library.books.find((item) => item.id === session.bookId);
    if (target) {
      openBook(target);
      panel.openSession(id, target.id);
    } else navigate({ scale: "chat", conversationId: id });
  };
  const sendOrdinaryQuestion = async (
    submission: PromptSubmission,
  ): Promise<boolean> => {
    if (!configured) {
      navigate({ scale: "settings" });
      return false;
    }
    const origin = location;
    const id = await chat.send({
      sessionId: chatSession?.id,
      book: chatSession?.bookId ? book : undefined,
      text: chatSession ? chatSession.draft : chat.homeDraft,
      submission,
      onSessionReady: (conversationId) => {
        // Navigate when the question is safely saved, never when a late answer arrives.
        if (
          !chatSession?.bookId &&
          locationRef.current === origin &&
          (origin.scale !== "chat" || origin.conversationId !== conversationId)
        )
          navigate({ scale: "chat", conversationId });
      },
    });
    return !!id;
  };
  const moveHistory = (direction: "back" | "forward") => {
    void routerNavigate(direction === "back" ? -1 : 1);
    setActiveAnnotation(null);
  };
  const attachPassage = (sessionId: string, anchor: AnnotationAnchor) => {
    const session = chat.getSession(sessionId);
    if (
      session?.draftPassage &&
      (session.draftPassage.quote !== anchor.quote ||
        session.draftPassage.paragraphId !== anchor.paragraphId)
    ) {
      showNotice("Remove the current quoted passage before adding another.");
      return false;
    }
    chat.setDraftPassage(sessionId, anchor);
    return true;
  };
  const openPanelSession = (id: string) => {
    setActiveAnnotation(null);
    setMessageFocus(undefined);
    if (panel.pendingPassage && attachPassage(id, panel.pendingPassage))
      panel.setPendingPassage(undefined);
    panel.openSession(id);
  };
  const newPanelSession = () => {
    const id = chat.startSession(book, true);
    if (!id) return;
    setActiveAnnotation(null);
    setMessageFocus(undefined);
    if (panel.pendingPassage) {
      chat.setDraftPassage(id, panel.pendingPassage);
      panel.setPendingPassage(undefined);
    }
    panel.openSession(id);
  };
  const compose = (anchor: AnnotationAnchor) => {
    panel.setOpen(true);
    const current = chat.getSession(panel.active);
    if (current && current.bookId === book.id)
      attachPassage(current.id, anchor);
    else {
      panel.setPendingPassage(anchor);
      panel.showList();
    }
  };
  const selectAnnotation = (annotation: Annotation) => {
    const session = chat.sessions.find((session) =>
      session.messages.some((message) => message.id === annotation.id),
    );
    if (!session) return;
    panel.openSession(session.id);
    setActiveAnnotation(annotation.id);
    setMessageFocus((current) => ({
      id: annotation.id,
      request: (current?.request ?? 0) + 1,
    }));
  };
  const selectAnnotations = (selection: AnnotationSelection) => {
    panel.showList(selection.ids);
    setActiveAnnotation(null);
  };
  const query = search.trim().toLowerCase();
  const bookSearchResults = library.books.filter((item) =>
    item.title.toLowerCase().includes(query),
  );
  const searchResults = query
    ? library.books
        .flatMap((target) =>
          target.chapters.flatMap((c) =>
            c.sections.map((s) => ({ book: target, chapter: c, section: s })),
          ),
        )
        .filter(({ chapter: c, section: s }) =>
          `${c.title} ${s.title} ${s.paragraphs.map((p) => p.text).join(" ")}`
            .toLowerCase()
            .includes(query),
        )
    : [];
  const conversationSearchResults = chat.sessions.filter(
    (session) =>
      session.messages.length > 0 &&
      (!query ||
        `${session.title} ${session.messages.map((message) => message.text).join(" ")}`
          .toLowerCase()
          .includes(query)),
  );
  const native = async (action: "minimize" | "toggleMaximize" | "close") => {
    try {
      await getCurrentWindow()[action]();
    } catch {
      showNotice("The window action could not be completed. Please try again.");
    }
  };
  const renderConversation = (session: ChatSession) => (
    <Suspense fallback={<RouteLoading />}>
      <ChatPage
        key={session.id}
        compact={inBook}
        messages={visibleMessages(session, integrations.entries)}
        integrationError={integrations.error}
        targetBooks={
          session.bookId
            ? library.books.filter((target) => target.id === session.bookId)
            : library.books
        }
        needsBookChoice={!session.bookId}
        onOrganize={(bookId) => {
          const target = library.books.find((item) => item.id === bookId);
          const current = chat.getSession(session.id);
          if (!target || !current)
            throw new Error(
              "This conversation or book is no longer available.",
            );
          const origin = location;
          const entry = integrations.integrate(current, target);
          panel.closeSession(session.id);
          setActiveAnnotation(null);
          setMessageFocus(undefined);
          if (origin.scale === "chat") navigate({ scale: "home" });
          const restore = () => {
            try {
              integrations.undo(entry.id);
              if (session.bookId) panel.openSession(session.id, session.bookId);
              navigate(origin);
              return true;
            } catch {
              showNotice(
                "Could not undo. Your conversation is still saved. Try Undo again.",
              );
              return false;
            }
          };
          setUndoNotices((current) => [
            ...current,
            {
              id: entry.id,
              title: "Conversation synthesized",
              onUndo: restore,
            },
          ]);
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>('[aria-label="Session list"]')
              ?.focus({ preventScroll: true }),
          );
        }}
        sessionId={session.id}
        scrollPositions={panel.scrollPositions}
        draftPassage={session.draftPassage}
        onRemovePassage={() => chat.setDraftPassage(session.id)}
        focusMessageId={messageFocus?.id}
        focusRequest={messageFocus?.request}
        onLocatePassage={(id, anchor) => {
          if (anchor.bookId !== book.id) return;
          if (
            location.scale !== "section" ||
            location.sectionId !== anchor.sectionId
          )
            navigate({
              scale: "section",
              bookId: anchor.bookId,
              chapterId: anchor.chapterId,
              sectionId: anchor.sectionId,
            });
          setActiveAnnotation(id);
          setAnnotationFocusRequest((request) => request + 1);
          const workspaceWidth =
            sessionToolbar?.closest(".reader-workspace")?.clientWidth ??
            window.innerWidth;
          if (workspaceWidth <= 720) panel.setOpen(false);
        }}
        value={session.draft}
        onChange={(text) => chat.setDraft(session.id, text)}
        attachments={session.draftAttachments}
        onAttachmentsChange={(files) =>
          chat.setDraftAttachments(session.id, files)
        }
        settings={modelSettings}
        pending={chat.pendingSessionId === session.id}
        busy={chat.busy || session.request?.status === "pending"}
        error={session.request?.error || chat.error || undefined}
        onSettings={() => navigate({ scale: "settings" })}
        onConfigure={() => navigate({ scale: "settings" })}
        onSend={sendOrdinaryQuestion}
        onRetry={
          session.request && session.request.status !== "pending"
            ? () => {
                if (!configured) {
                  navigate({ scale: "settings" });
                  return;
                }
                void chat.retry(session.id, session.bookId ? book : undefined, {
                  ...session.request!.options,
                  model: promptChoices(modelSettings).models.some(
                    (model) => model.id === session.request!.options.model,
                  )
                    ? session.request!.options.model
                    : modelSettings.model,
                });
              }
            : undefined
        }
      />
    </Suspense>
  );
  const routeContext: AppRouteContext = {
    home: {
      value: chat.homeDraft,
      onChange: chat.setHomeDraft,
      attachments: chat.homeAttachments,
      onAttachmentsChange: chat.setHomeAttachments,
      settings: modelSettings,
      pending: false,
      busy: chat.busy,
      error: chat.error || recent.error || undefined,
      onSettings: () => navigate({ scale: "settings" }),
      onConfigure: () => navigate({ scale: "settings" }),
      onSend: sendOrdinaryQuestion,
    },
    library: {
      projects: projects.projects,
      sections: projects.sections,
      saving: projects.saving,
      onChange: projects.updateLibrary,
      recent: recent.entries,
      selecting: selectingProjects,
      onSelectingChange: setSelectingProjects,
      onSectionAction: setSectionAction,
      onOpen: (project) =>
        navigate({ scale: "project", projectId: project.id }),
    },
    project: { onStart: startProject },
    settings: {
      settings: modelSettings,
      loadError: modelLoadError,
      onSave: saveModel,
    },
    conversation: chatSession ? (
      renderConversation(chatSession)
    ) : (
      <RouteLoading />
    ),
    book,
    reader:
      location.scale === "section" &&
      chapter?.id === location.chapterId &&
      section?.id === location.sectionId
        ? {
            book,
            chapter,
            section,
            annotations: notes,
            activeAnnotationId: activeAnnotation,
            previewAnnotationId: null,
            annotationFocusRequest,
            onAskAI: compose,
            onSelectAnnotation: (id) => {
              const annotation = notes.find((item) => item.id === id);
              if (annotation) selectAnnotation(annotation);
            },
            onSelectAnnotations: selectAnnotations,
            onNavigate: (chapterId, sectionId) =>
              navigate({
                scale: "section",
                bookId: book.id,
                chapterId,
                sectionId,
              }),
          }
        : null,
  };
  return (
    <SidebarProvider
      className="desktop-app"
      mobileBreakpoint={panelVisible ? 1180 : 768}
      style={{ "--sidebar-width": "256px" } as React.CSSProperties}
    >
      <LibrarySidebar
        footer={
          <GettingStarted
            configured={configured}
            projects={projects.projects}
            details={projects.details}
            loading={projects.loading}
            loadDetail={projects.loadDetail}
            onNavigate={navigate}
          />
        }
        book={book}
        onNewProject={() => navigate({ scale: "home" })}
        onNewSection={() => setSectionAction({ kind: "create" })}
        onSelectProjects={() => {
          setSelectingProjects(true);
          if (location.scale !== "library") void routerNavigate("/library");
        }}
        location={location}
        onNavigate={navigate}
        onSearch={() => setSearchOpen(true)}
        showContents={
          inBook || (location.scale === "chat" && !!chatSession?.bookId)
        }
      />
      {sectionAction && (
        <LibrarySectionDialog
          key={
            sectionAction.kind +
            (sectionAction.kind === "create" ? "" : sectionAction.section.id)
          }
          action={sectionAction}
          onClose={() => setSectionAction(null)}
          saving={projects.saving}
          onChange={async (change) => {
            await projects.updateLibrary(change);
            await revalidator.revalidate();
          }}
        />
      )}
      <SidebarInset
        className="reader-workspace"
        style={
          {
            "--session-panel-width": sessionPanelWidth
              ? `${sessionPanelWidth}px`
              : undefined,
          } as React.CSSProperties
        }
      >
        <header
          className="app-topbar flex items-center justify-between gap-4"
          data-tauri-drag-region
        >
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <SidebarReopenButton />
            {navigation.state !== "idle" && (
              <span className="route-navigation-status" role="status">
                Loading…
              </span>
            )}
            <IconButton
              label="Go back"
              disabled={historyIndex === 0}
              onClick={() => moveHistory("back")}
            >
              <ArrowLeft />
            </IconButton>
            <IconButton
              label="Go forward"
              disabled={historyIndex >= lastHistoryIndex}
              onClick={() => moveHistory("forward")}
            >
              <ArrowRight />
            </IconButton>
            {(inBook || chatSession || location.scale === "project") && (
              <div className="app-breadcrumb ml-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {location.scale === "project"
                    ? projects.projects.find(
                        (project) => project.id === location.projectId,
                      )?.title
                    : chatSession
                      ? chatSession.bookId
                        ? book.title
                        : chatSession.title
                      : book.title}
                </span>
                {location.scale === "section" && chapter && (
                  <>
                    <span className="text-muted-foreground/50">/</span>
                    <span className="truncate">{chapter.title}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div
            className={`flex min-w-8 items-center justify-end gap-1 ${panelVisible ? "session-toolbar" : ""}`}
            data-tauri-drag-region
          >
            {panelVisible && (
              <div
                ref={setSessionToolbar}
                className="flex h-full min-w-0 flex-1"
              />
            )}
            {location.scale === "chat" && chatSession?.bookId && (
              <IconButton label="Read book" onClick={() => openBook(book)}>
                <BookOpen />
              </IconButton>
            )}
            {inBook && (
              <IconButton
                label={
                  panelVisible
                    ? "Collapse session panel"
                    : "Expand session panel"
                }
                aria-pressed={panelVisible}
                aria-controls="session-panel"
                variant={panelVisible ? "secondary" : "ghost"}
                onClick={() => {
                  panel.setOpen(!panel.open);
                  if (panel.open) setActiveAnnotation(null);
                }}
              >
                <PanelRight />
              </IconButton>
            )}
            {isTauri() && (
              <>
                <IconButton
                  label="Minimize"
                  onClick={() => void native("minimize")}
                >
                  <Minus />
                </IconButton>
                <IconButton
                  label="Maximize window"
                  onClick={() => void native("toggleMaximize")}
                >
                  <Maximize2 />
                </IconButton>
                <IconButton
                  label="Close window"
                  className="hover:bg-red-50 hover:text-red-600"
                  onClick={() => void native("close")}
                >
                  <X />
                </IconButton>
              </>
            )}
          </div>
        </header>
        {library.error && (
          <Alert
            variant="destructive"
            className="rounded-none border-x-0 border-t-0"
          >
            <AlertDescription className="flex items-center justify-between gap-3">
              {library.error}
              <Button variant="outline" size="sm" onClick={library.retry}>
                Retry loading
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <ReaderSplit
          onPanelWidthChange={setSessionPanelWidth}
          panel={
            panelVisible ? (
              <SessionPanel
                toolbar={sessionToolbar}
                state={panel}
                sessions={chat.sessions
                  .filter((session) => session.bookId === book.id)
                  .map((session) => ({
                    ...session,
                    messages: visibleMessages(session, integrations.entries),
                  }))
                  .sort(
                    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
                  )}
                renderSession={renderConversation}
                error={chat.error || undefined}
                onSelect={openPanelSession}
                onList={() => {
                  panel.showList();
                  setActiveAnnotation(null);
                  setMessageFocus(undefined);
                }}
                onCloseTab={panel.closeSession}
                onNew={newPanelSession}
                onClearPassage={() => panel.setPendingPassage(undefined)}
              />
            ) : null
          }
        >
          <Outlet context={routeContext} />
        </ReaderSplit>
      </SidebarInset>
      <UndoToasts
        notices={undoNotices}
        onDismiss={(id) =>
          setUndoNotices((current) =>
            current.filter((notice) => notice.id !== id),
          )
        }
      />
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="gap-4 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription className="sr-only">
              Search books, chapter titles and conversations.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Search books, chapters and conversations"
            placeholder="Search books, chapters, or conversations…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {bookSearchResults.map((target) => (
              <Button
                key={target.id}
                variant="ghost"
                className="h-auto w-full justify-start gap-3 py-3"
                onClick={() => openBook(target)}
              >
                <BookOpen className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-left">
                  {target.title}
                </span>
                <ArrowRight className="text-muted-foreground" />
              </Button>
            ))}
            {searchResults.map(({ book: target, chapter: c, section: s }) => (
              <Button
                key={s.id}
                variant="ghost"
                className="h-auto w-full justify-start gap-3 py-3"
                onClick={() =>
                  navigate({
                    scale: "section",
                    bookId: target.id,
                    chapterId: c.id,
                    sectionId: s.id,
                  })
                }
              >
                <BookOpen className="text-muted-foreground" />
                <span className="flex-1 text-left">
                  <span className="block text-sm">{s.title}</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {target.title} / {c.title}
                  </span>
                </span>
                <ArrowRight className="text-muted-foreground" />
              </Button>
            ))}
            {conversationSearchResults.map((session) => (
              <Button
                key={session.id}
                variant="ghost"
                className="h-auto w-full justify-start gap-3 py-3"
                onClick={() => openSavedConversation(session.id)}
              >
                <MessagesSquare className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-left">
                  {session.title}
                </span>
                <ArrowRight className="text-muted-foreground" />
              </Button>
            ))}
            {!searchResults.length &&
              !bookSearchResults.length &&
              !conversationSearchResults.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No results.
                </p>
              )}
          </div>
        </DialogContent>
      </Dialog>
      {notice && (
        <Alert className="notice-toast shadow-lg" role="status">
          <AlertDescription className="flex items-start justify-between gap-3">
            {notice}
            <IconButton label="Dismiss" onClick={() => setNotice("")}>
              <X />
            </IconButton>
          </AlertDescription>
        </Alert>
      )}
    </SidebarProvider>
  );
}
