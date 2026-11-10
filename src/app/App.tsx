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
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  MessagesSquare,
  PanelRight,
} from "@/components/ui/icons";
import { EmptyState, RuntimeErrorNotice } from "@/components/ui/feedback";
import { ToastNotice } from "@/components/ui/toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { SearchInput } from "@/components/ui/search-input";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { IconButton } from "@/components/ui/IconButton";
import {
  LibrarySectionDialog,
  type SectionAction,
} from "@/features/library/LibrarySectionDialog";
import { LibrarySidebar } from "@/features/library/LibrarySidebar";
import { SettingsSidebar } from "@/features/settings/SettingsSidebar";
import { GettingStarted } from "@/features/home/GettingStarted";
import { useProjects } from "@/features/projects/useProjects";
import {
  projectBook,
  type ProjectDetail,
} from "@/features/projects/project-data";
import { WorkspaceSplit } from "./WorkspaceSplit";
import { TextbookPanel } from "@/features/reader/TextbookPanel";
import { EmptyBook } from "@/features/reader/EmptyBook";
import { ConversationSidebar } from "@/features/chat/ConversationSidebar";
import { sessionPassages } from "@/features/chat/session-passages";
import type { ChatSession } from "@/features/chat/chat-store";
import { useChat } from "@/features/chat/useChat";
import { useBookIntegrations } from "@/features/chat/useBookIntegrations";
import { projectConversation } from "@/features/chat/project-conversation";
import {
  loadRecentLearning,
  recordRecentLearning,
  latestReadingLocations,
  RECENT_LEARNING_STORAGE_KEY,
  type RecentLearningEntry,
} from "@/features/home/recent-learning";
import { PrimaryRail } from "./PrimaryRail";
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

const ReadingDocument = lazy(() =>
  import("@/features/reader/ReadingDocument").then((module) => ({
    default: module.ReadingDocument,
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
  const topbar = useRef<HTMLElement>(null);
  const nativeMac = isTauri() && /Mac/.test(navigator.platform);
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
  const activeMatch = [...matches]
    .reverse()
    .find(
      (match) =>
        (match.handle as ReaderRouteHandle | undefined)?.readerLocation,
    );
  const matchedLocation: ReaderLocation = activeMatch
    ? (activeMatch.handle as ReaderRouteHandle).readerLocation(
        activeMatch.params,
      )
    : { scale: "home" };
  // A lazy route can register its handle after the pathname changes. Track the
  // resolved destination while keeping its identity stable during revalidation.
  const locationKey = JSON.stringify(matchedLocation);
  const location = useMemo(() => matchedLocation, [locationKey]);
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
  // Track title-bar button availability only; the router owns history, navigation, and POP behavior.
  const [lastHistoryIndex, setLastHistoryIndex] = useState(historyIndex);
  useEffect(() => {
    // During a POP loader, the browser index has changed but the router still displays the previous page.
    // Update button bounds only after the location commits; a pending index must not be treated as a new PUSH.
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
  const projects = useProjects();
  const integrations = useBookIntegrations();
  // The reader projects textbooks from the project catalog; it owns no separate book catalog.
  const routeProject = matches
    .map((match) => match.loaderData as ProjectDetail | undefined)
    .find((detail) => detail?.project && detail?.goal && detail?.plan);
  const projectBooks = projects.projects.map((project) =>
    projectBook(
      project,
      routeProject?.project.id === project.id
        ? routeProject
        : projects.details[project.id],
    ),
  );
  const library = {
    books: projectBooks
      .concat(
        routeBook && !projectBooks.some((item) => item.id === routeBook.id)
          ? [routeBook]
          : [],
      )
      .map((item) =>
        integrations.project(routeBook?.id === item.id ? routeBook : item),
      ),
  };
  const chat = useChat();
  const [recent, setRecent] = useState(loadRecent);
  const [textbookPanels, setTextbookPanels] = useState<Record<string, boolean>>(
    {},
  );
  const scrollPositions = useRef(new Map<string, number>());
  const activeProjectSessions = useRef<Record<string, string>>({});
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
            error instanceof Error
              ? error.message
              : typeof error === "string"
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
    Object.values(latestReadingLocations(recent.entries))[0] ?? {
      scale: "home",
    },
  );
  const readingLocations = useRef<Record<string, ReaderLocation>>({
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
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const openSearch = () => {
    searchReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSearchOpen(true);
  };
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(
    null,
  );
  const noticeSequence = useRef(0);
  const routeChatSession =
    location.scale === "chat"
      ? chat.getSession(location.conversationId)
      : undefined;
  const currentBookLocation: ReaderLocation =
    location.scale === "section" || location.scale === "book"
      ? location
      : routeChatSession?.bookId
        ? (readingLocations.current[routeChatSession.bookId] ?? {
            scale: "book",
            bookId: routeChatSession.bookId,
          })
        : readingLocation.current;
  const book = library.books.find(
    (item) =>
      item.id ===
      (location.scale === "chat"
        ? routeChatSession?.bookId
        : location.scale === "project"
          ? location.projectId
          : "bookId" in currentBookLocation
            ? currentBookLocation.bookId
            : undefined),
  );
  const chapter =
    book?.chapters.find(
      (c) =>
        currentBookLocation.scale === "section" &&
        c.id === currentBookLocation.chapterId,
    ) ?? book?.chapters.find((chapter) => chapter.sections.length > 0);
  const section =
    chapter?.sections.find(
      (s) =>
        currentBookLocation.scale === "section" &&
        s.id === currentBookLocation.sectionId,
    ) ?? chapter?.sections[0];
  const inBook = location.scale === "section" || location.scale === "book";
  const setTextbookOpen = (open: boolean) => {
    if (book) setTextbookPanels((current) => ({ ...current, [book.id]: open }));
  };
  const inProject = location.scale === "project";
  const panelVisible =
    !!book &&
    (inBook || (location.scale === "chat" && textbookPanels[book.id] === true));
  const projectChat = book
    ? projectConversation(
        chat.sessions,
        book.id,
        routeChatSession?.id ?? activeProjectSessions.current[book.id],
      )
    : undefined;
  const chatSession =
    location.scale === "chat"
      ? routeChatSession
      : inBook || inProject
        ? projectChat?.current
        : undefined;
  useEffect(() => {
    if (routeChatSession?.bookId)
      activeProjectSessions.current[routeChatSession.bookId] =
        routeChatSession.id;
  }, [routeChatSession?.id, routeChatSession?.bookId]);
  const inConversations =
    location.scale === "home" || location.scale === "chat" || inBook;
  const notes = sessionPassages(chat.sessions);
  const [messageFocus, setMessageFocus] = useState<{
    id: string;
    request: number;
  }>();
  const recordedLocation = useRef<ReaderLocation | null>(null);
  useEffect(() => {
    const readingChanged = recordedLocation.current !== location;
    recordedLocation.current = location;
    // Toggling the textbook is not a new learning visit.
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
    setNotice({ id: ++noticeSequence.current, text });
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!searchOpen)
          searchReturnFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        setSearchOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchOpen]);
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
    if (!project) {
      showNotice("This project could not be found.");
      return;
    }
    const cached = projects.getCached(project.id);
    if (cached)
      return navigateToBook(integrations.project(projectBook(project, cached)));
    const origin = locationRef.current;
    void projects
      .loadDetail(project.id)
      .then((detail) => {
        // A late response must not navigate back after the user has left the page.
        if (locationRef.current === origin)
          navigateToBook(integrations.project(projectBook(project, detail)));
      })
      .catch(() =>
        showNotice("Could not open this project. Please try again."),
      );
  };
  const ensureProjectChat = (target: LearningBook) =>
    projectConversation(
      chat.sessions,
      target.id,
      activeProjectSessions.current[target.id],
    ).current?.id ?? chat.startSession(target);
  const startProject = (detail: ProjectDetail) => {
    const target = integrations.project(projectBook(detail.project, detail));
    const sessionId = ensureProjectChat(target);
    if (!sessionId)
      throw new Error(
        "Could not open this conversation. Check local storage and try again.",
      );
    navigate({ scale: "chat", conversationId: sessionId });
    const current = chat.getSession(sessionId);
    if (configured && !current?.request) void chat.startLearning(sessionId, {});
  };
  const openSavedConversation = (id: string, messageId?: string) => {
    const session = chat.getSession(id);
    if (!session) return;
    navigate({ scale: "chat", conversationId: id });
    if (messageId)
      setMessageFocus((current) => ({
        id: messageId,
        request: (current?.request ?? 0) + 1,
      }));
  };
  const sendOrdinaryQuestion = async (
    submission: PromptSubmission,
  ): Promise<boolean> => {
    if (!configured) {
      navigate({ scale: "settings" });
      return false;
    }
    const origin = location;
    setMessageFocus(undefined);
    const id = await chat.send({
      sessionId: chatSession?.id,
      book: chatSession?.bookId ? book : undefined,
      text: chatSession ? chatSession.draft : chat.homeDraft,
      submission,
      onSessionReady: (conversationId) => {
        // Navigate when the question is safely saved, never when a late answer arrives.
        if (
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
  const closeTextbook = () => {
    setTextbookOpen(false);
    if (inBook) {
      if (chatSession)
        navigate({ scale: "chat", conversationId: chatSession.id });
      else if (book) navigate({ scale: "project", projectId: book.id });
    }
  };
  const openConversation = (id: string) => {
    setActiveAnnotation(null);
    setMessageFocus(undefined);
    navigate({ scale: "chat", conversationId: id });
  };
  const compose = (anchor: AnnotationAnchor) => {
    if (!book) return;
    const id = ensureProjectChat(book);
    if (!id) return;
    if (attachPassage(id, anchor)) {
      setTextbookOpen(true);
      navigate({ scale: "chat", conversationId: id });
      setMessageFocus(undefined);
    }
  };
  const selectAnnotation = (annotation: Annotation) => {
    const session = chat.sessions.find((session) =>
      session.messages.some((message) => message.id === annotation.id),
    );
    if (!session) return;
    setTextbookOpen(true);
    navigate({
      scale: "chat",
      conversationId: session.id,
    });
    setActiveAnnotation(annotation.id);
    setMessageFocus((current) => ({
      id: annotation.id,
      request: (current?.request ?? 0) + 1,
    }));
  };
  const selectAnnotations = (selection: AnnotationSelection) => {
    const annotation = notes.find((item) => selection.ids.includes(item.id));
    if (annotation) selectAnnotation(annotation);
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
  const conversationSearchResults = chat.sessions.flatMap((session) =>
    session.messages
      .filter((message) => query && message.text.toLowerCase().includes(query))
      .map((message) => ({ session, message })),
  );
  const renderConversation = (session: ChatSession) => (
    <Suspense fallback={<RouteLoading conversation />}>
      <ChatPage
        key={session.id}
        compact={panelVisible}
        messages={session.messages}
        sessionId={session.id}
        scrollPositions={scrollPositions.current}
        draftPassage={session.draftPassage}
        onRemovePassage={() => chat.setDraftPassage(session.id)}
        focusMessageId={messageFocus?.id}
        focusRequest={messageFocus?.request}
        onLocatePassage={(id, anchor) => {
          if (anchor.bookId !== book?.id) return;
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
          setTextbookOpen(true);
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
        onCancel={() => {
          void chat.cancel();
        }}
        onRetry={
          session.request && session.request.status !== "pending"
            ? () => {
                if (!configured) {
                  navigate({ scale: "settings" });
                  return;
                }
                void chat.retry(session.id, {
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
  const currentConversation = chatSession ? (
    renderConversation(chatSession)
  ) : (
    <RouteLoading />
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
      onOpen: (project) =>
        navigate({ scale: "project", projectId: project.id }),
    },
    project: {
      onStart: startProject,
    },
    settings: {
      settings: modelSettings,
      loadError: modelLoadError,
      onSave: saveModel,
    },
    conversation: currentConversation,
    book,
    reader:
      book &&
      chapter &&
      section &&
      (location.scale !== "section" ||
        (chapter.id === location.chapterId &&
          section.id === location.sectionId))
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
      className={`desktop-app${nativeMac ? " desktop-app--macos" : ""}`}
      mobileBreakpoint={panelVisible ? 1180 : 768}
    >
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
      <header ref={topbar} className="app-topbar" data-tauri-drag-region>
        <div className="app-topbar-conversation" data-tauri-drag-region>
          <div className="app-topbar-leading" data-tauri-drag-region>
            <div className="app-topbar-history" aria-label="Navigation history">
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
            </div>
            <SidebarReopenButton />
          </div>
          <div className="app-breadcrumb" data-tauri-drag-region>
            {(((inBook || inProject) && book) || chatSession) && (
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  variant="ghost"
                  shape="default"
                  className="breadcrumb-project"
                  onClick={() => {
                    if (book)
                      navigate({ scale: "project", projectId: book.id });
                  }}
                >
                  {book
                    ? (projects.projects.find(
                        (project) => project.id === book.id,
                      )?.title ?? book.title)
                    : chatSession?.title}
                </Button>
                {location.scale === "section" && chapter && (
                  <>
                    <span className="text-muted-foreground/50">/</span>
                    <span className="truncate">{chapter.title}</span>
                  </>
                )}
              </div>
            )}
            {!(((inBook || inProject) && book) || chatSession) && (
              <span className="truncate">
                {location.scale === "settings"
                  ? "Settings"
                  : location.scale === "library"
                    ? "Library"
                    : "New conversation"}
              </span>
            )}
            {navigation.state !== "idle" && (
              <span className="route-navigation-status" role="status">
                Loading…
              </span>
            )}
          </div>
        </div>
        <div className="app-topbar-actions" data-tauri-drag-region>
          {(inBook || (location.scale === "chat" && book)) && (
            <IconButton
              label={panelVisible ? "Close textbook" : "Open textbook"}
              aria-pressed={panelVisible}
              aria-controls="textbook-panel"
              variant={panelVisible ? "secondary" : "ghost"}
              onClick={() => {
                if (panelVisible) closeTextbook();
                else setTextbookOpen(true);
              }}
            >
              <PanelRight />
            </IconButton>
          )}
        </div>
      </header>
      <PrimaryRail
        location={location}
        onNavigate={navigate}
        gettingStarted={
          <GettingStarted
            configured={configured}
            projects={projects.projects}
            details={projects.details}
            loading={projects.loading}
            loadDetail={projects.loadDetail}
            onNavigate={navigate}
          />
        }
      />
      <div className="workspace-island">
        {location.scale === "settings" ? (
          <SettingsSidebar />
        ) : inConversations ? (
          <ConversationSidebar
            projects={projects.projects}
            sessions={chat.sessions}
            location={
              inBook && chatSession
                ? { scale: "chat", conversationId: chatSession.id }
                : location
            }
            pendingSessionId={chat.pendingSessionId}
            onNavigate={navigate}
            onNewProjectChat={(project) => {
              const id = chat.startSession(project, true);
              if (id) openConversation(id);
            }}
          />
        ) : (
          <LibrarySidebar
            sections={projects.sections}
            projects={projects.projects}
            saving={projects.saving}
            onSearch={openSearch}
            active={location.scale === "library"}
            onSectionAction={setSectionAction}
            onSelectProjects={(sectionId) => {
              if (
                location.scale !== "library" ||
                new URLSearchParams(routerLocation.search).get("section") !==
                  sectionId
              ) {
                void routerNavigate(
                  sectionId
                    ? `/library?section=${encodeURIComponent(sectionId)}`
                    : "/library",
                );
              }
              setSelectingProjects(true);
            }}
          />
        )}
        <SidebarInset className="reader-workspace">
          {projects.error && (
            <RuntimeErrorNotice
              title="Could not load projects"
              className="workspace-error"
              action={
                <Button variant="outline" size="sm" onClick={projects.retry}>
                  Retry loading
                </Button>
              }
            >
              {projects.error}
            </RuntimeErrorNotice>
          )}
          <WorkspaceSplit
            onSupportResize={(width) =>
              topbar.current?.style.setProperty(
                "--support-panel-width",
                `${width}px`,
              )
            }
            panel={
              panelVisible && book ? (
                <TextbookPanel>
                  <Suspense fallback={<RouteLoading />}>
                    {inBook ? (
                      <Outlet context={routeContext} />
                    ) : routeContext.reader ? (
                      <ReadingDocument {...routeContext.reader} />
                    ) : (
                      <EmptyBook book={book} />
                    )}
                  </Suspense>
                </TextbookPanel>
              ) : null
            }
          >
            {inBook ? (
              chatSession && currentConversation
            ) : (
              <Outlet context={routeContext} />
            )}
            {inBook && !chatSession && book && (
              <EmptyState title="Learn through conversation">
                Ask a question about this project. Your textbook stays alongside
                the conversation.
                <Button
                  className="mt-4"
                  onClick={() => {
                    const id = ensureProjectChat(book);
                    if (id) navigate({ scale: "chat", conversationId: id });
                  }}
                >
                  Start conversation
                </Button>
              </EmptyState>
            )}
          </WorkspaceSplit>
        </SidebarInset>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent
          className="gap-4 sm:max-w-xl"
          onCloseAutoFocus={(event) => {
            if (searchReturnFocus.current?.isConnected) {
              event.preventDefault();
              searchReturnFocus.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription className="sr-only">
              Search projects, textbook passages and conversations.
            </DialogDescription>
          </DialogHeader>
          <SearchInput
            onClear={() => setSearch("")}
            aria-label="Search projects, passages and conversations"
            placeholder="Search projects, passages, or conversations…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <ScrollArea className="search-results">
            <div className="space-y-1">
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
              {conversationSearchResults.map(({ session, message }) => (
                <Button
                  key={`${session.id}:${message.id}`}
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 py-3"
                  onClick={() => openSavedConversation(session.id, message.id)}
                >
                  <MessagesSquare className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="line-clamp-2 whitespace-normal text-foreground">
                      {message.text}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {projects.projects.find(
                        (project) => project.id === session.bookId,
                      )?.title ?? session.title}{" "}
                      · {message.role === "user" ? "Question" : "Answer"}
                    </span>
                  </span>
                  <ArrowRight className="text-muted-foreground" />
                </Button>
              ))}
              {!searchResults.length &&
                !bookSearchResults.length &&
                !conversationSearchResults.length && (
                  <EmptyState>No results.</EmptyState>
                )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      {notice && (
        <ToastNotice key={notice.id} onClose={() => setNotice(null)}>
          {notice.text}
        </ToastNotice>
      )}
    </SidebarProvider>
  );
}
