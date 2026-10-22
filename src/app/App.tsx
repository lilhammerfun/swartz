import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  MessageSquare,
  MessagesSquare,
  Maximize2,
  Minus,
  Plus,
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
import { LibrarySidebar } from "@/features/library/LibrarySidebar";
import { LibraryPage } from "@/features/library/LibraryPage";
import { NewBookDialog } from "@/features/library/NewBookDialog";
import { useLibrary } from "@/features/library/useLibrary";
import { EmptyBook } from "@/features/reader/EmptyBook";
import { HomePage } from "@/features/home/HomePage";
import { FloatingConversation } from "@/features/chat/FloatingConversation";
import { useChat } from "@/features/chat/useChat";
import {
  loadRecentLearning,
  recordRecentLearning,
  latestReadingLocations,
  RECENT_LEARNING_STORAGE_KEY,
  type RecentLearningEntry,
} from "@/features/home/recent-learning";
import { SidebarReopenButton } from "./SidebarReopenButton";
import type {
  QuestionComposer,
  DiscussionDraft,
} from "@/features/annotations/AnnotationPane";
import type { AnnotationSelection } from "@/features/annotations/annotation-selection";
import { SettingsPage } from "@/features/settings/SettingsPage";
import {
  defaultModelSettings,
  modelIsConfigured,
  type ModelSettings,
  type ModelConfig,
} from "@/features/model/model-api";
import {
  loadModelSettings,
  saveModelSettings,
  askModel,
} from "@/features/model/model-service";
import {
  promptChoices,
  type PromptSubmission,
} from "@/features/annotations/prompt-options";
import { learningMessages } from "@/features/model/learning-messages";
import { useAnnotations } from "@/features/annotations/useAnnotations";
import { readingAnnotations } from "@/features/annotations/reading-annotations";
import { initialLocation, learningBook as starterBook } from "@/mock-data/book";
import type {
  Annotation,
  AnnotationAnchor,
  ReaderLocation,
  LearningBook,
  PromptAttachment,
} from "@/types/book";

const AnnotationPane = lazy(() =>
  import("@/features/annotations/AnnotationPane").then((module) => ({
    default: module.AnnotationPane,
  })),
);
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
  const library = useLibrary(starterBook);
  const notes = useAnnotations();
  const chat = useChat();
  const [floatingConversation, setFloatingConversation] = useState<
    string | null
  >(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [recent, setRecent] = useState(loadRecent);
  const [location, setLocation] = useState<ReaderLocation>({ scale: "home" });
  const [annotationsOpen, setAnnotationsOpen] = useState(
    notes.annotations.length > 0,
  );
  const [composer, setComposer] = useState<QuestionComposer | null>(null);
  const [draft, setDraft] = useState("");
  const [questionAttachments, setQuestionAttachments] = useState<
    PromptAttachment[]
  >([]);
  const [discussionDrafts, setDiscussionDrafts] = useState<
    Record<string, DiscussionDraft>
  >({});
  const annotationScrollPositions = useRef(new Map<string, number>());
  const [annotationSelection, setAnnotationSelection] =
    useState<AnnotationSelection | null>(null);
  const [previewAnnotation, setPreviewAnnotation] = useState<string | null>(
    null,
  );
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [modelSettings, setModelSettings] =
    useState<ModelSettings>(defaultModelSettings);
  const [modelLoadError, setModelLoadError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const busy = useRef(false);
  const [requestError, setRequestError] = useState<{
    id: string;
    message: string;
  } | null>(null);
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
  const activeAnnotationRef = useRef(activeAnnotation);
  useEffect(() => {
    activeAnnotationRef.current = activeAnnotation;
  }, [activeAnnotation]);
  const [annotationFocusRequest, setAnnotationFocusRequest] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<ReaderLocation[]>([]);
  const [future, setFuture] = useState<ReaderLocation[]>([]);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentBookLocation =
    location.scale === "section" || location.scale === "book"
      ? location
      : readingLocation.current;
  const chatSession =
    location.scale === "chat"
      ? chat.getSession(location.conversationId)
      : (location.scale === "book" || location.scale === "section") &&
          conversationOpen
        ? chat.getSession(floatingConversation ?? "")
        : undefined;
  const book =
    library.books.find(
      (item) =>
        item.id ===
        (location.scale === "chat"
          ? chatSession?.bookId
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
  const annotationPaneVisible = location.scale === "section" && annotationsOpen;
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
    setHistory((items) => [...items, location]);
    setFuture([]);
    setConversationOpen(false);
    setLocation(next);
    setActiveAnnotation(null);
    setAnnotationSelection(null);
    setPreviewAnnotation(null);
    setSearchOpen(false);
  };
  const openBook = (target: LearningBook) => {
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
  const openConversation = (open: boolean) => {
    if (!open) return setConversationOpen(false);
    const id = chat.startSession(book);
    if (id) {
      setFloatingConversation(id);
      setConversationOpen(true);
    } else
      showNotice("The conversation could not be opened. Please try again.");
  };
  const openSavedConversation = (id: string) => {
    const session = chat.getSession(id);
    if (!session) return;
    const target = library.books.find((item) => item.id === session.bookId);
    if (target) {
      openBook(target);
      setFloatingConversation(id);
      setConversationOpen(true);
    } else navigate({ scale: "chat", conversationId: id });
  };
  const resumeLearning = (id: string) => {
    const entry = recent.entries.find((item) => item.id === id);
    if (!entry) return;
    if (entry.location.scale === "chat") {
      openSavedConversation(entry.location.conversationId);
    } else {
      const target = library.books.find((item) => item.id === entry.bookId);
      if (target) openBook(target);
    }
  };
  const recentBooks = recent.entries
    .flatMap((entry) => {
      if (entry.location.scale === "chat") {
        const session = chat.getSession(entry.location.conversationId);
        if (!session || !session.messages.length) return [];
        const target = library.books.find((item) => item.id === session.bookId);
        return [
          {
            id: entry.id,
            title: target?.title ?? session.title,
            subtitle: target
              ? (session.messages.filter((m) => m.role === "user").at(-1)
                  ?.text ?? "")
              : "",
          },
        ];
      }
      const target = library.books.find((item) => item.id === entry.bookId);
      if (!target) return [];
      const destination = entry.location;
      const section =
        destination.scale === "section"
          ? target.chapters
              .find((c) => c.id === destination.chapterId)
              ?.sections.find((s) => s.id === destination.sectionId)
          : undefined;
      return [
        { id: entry.id, title: target.title, subtitle: section?.title ?? "" },
      ];
    })
    .slice(0, 3);
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
    const source = direction === "back" ? history : future;
    const target = source.at(-1);
    if (!target) return;
    if (direction === "back") {
      setHistory(source.slice(0, -1));
      setFuture((items) => [...items, location]);
    } else {
      setFuture(source.slice(0, -1));
      setHistory((items) => [...items, location]);
    }
    setConversationOpen(false);
    setLocation(target);
    setActiveAnnotation(null);
    setAnnotationSelection(null);
    setPreviewAnnotation(null);
  };
  const compose = (anchor: AnnotationAnchor) => {
    if (busy.current) {
      showNotice(
        "Wait for the current AI response before starting another question.",
      );
      return;
    }
    setRequestError(null);
    if (
      composer &&
      (draft.trim() || questionAttachments.length > 0) &&
      (composer.anchor.paragraphId !== anchor.paragraphId ||
        composer.anchor.quote !== anchor.quote)
    ) {
      showNotice("Discard your current question before starting another.");
      setAnnotationsOpen(true);
      return;
    }
    setComposer({ anchor: structuredClone(anchor) });
    setAnnotationsOpen(true);
    setActiveAnnotation(null);
    setAnnotationSelection(null);
    setPreviewAnnotation(null);
  };
  const canBrowseAnnotations = () => {
    if (
      composer?.anchor.bookId === book.id &&
      composer.anchor.sectionId === section?.id
    ) {
      if (
        pendingId === "new" ||
        draft.trim() ||
        questionAttachments.length > 0
      ) {
        showNotice(
          "Discard your current question before opening another discussion.",
        );
        return false;
      }
      setComposer(null);
    }
    return true;
  };
  const selectAnnotation = (
    annotation: Annotation,
    locate = false,
    keepSelection = false,
  ) => {
    if (!canBrowseAnnotations()) return;
    if (
      location.scale !== "section" ||
      location.bookId !== annotation.anchor.bookId ||
      location.chapterId !== annotation.anchor.chapterId ||
      location.sectionId !== annotation.anchor.sectionId
    )
      setLocation({
        scale: "section",
        bookId: annotation.anchor.bookId,
        chapterId: annotation.anchor.chapterId,
        sectionId: annotation.anchor.sectionId,
      });
    setActiveAnnotation(annotation.id);
    if (!keepSelection) setAnnotationSelection(null);
    setPreviewAnnotation(null);
    if (locate) setAnnotationFocusRequest((request) => request + 1);
    setAnnotationsOpen(true);
  };
  const selectAnnotations = (selection: AnnotationSelection) => {
    if (!canBrowseAnnotations()) return;
    setAnnotationSelection(selection);
    setActiveAnnotation(null);
    setPreviewAnnotation(null);
    setAnnotationsOpen(true);
  };
  const sendQuestion = async (
    anchor: AnnotationAnchor,
    question: string,
    submission: PromptSubmission,
    discussion?: Annotation,
  ): Promise<boolean> => {
    if (busy.current || !question.trim()) return false;
    if (!configured) {
      navigate({ scale: "settings" });
      return false;
    }
    const target = discussion?.id ?? "new";
    busy.current = true;
    setPendingId(target);
    setRequestError(null);
    try {
      const answer = await askModel(
        learningMessages(
          book,
          anchor,
          question.trim(),
          discussion,
          submission.attachments,
        ),
        submission,
      );
      let id = discussion?.id;
      if (id)
        notes.appendAnsweredExchange(
          id,
          question,
          answer,
          submission.attachments,
        );
      else {
        id = notes.addAnsweredQuestion(
          anchor,
          question,
          answer,
          submission.attachments,
        ).id;
        setComposer(null);
        setDraft("");
        setQuestionAttachments([]);
      }
      if (
        locationRef.current.scale === "section" &&
        locationRef.current.bookId === anchor.bookId &&
        locationRef.current.sectionId === anchor.sectionId &&
        (!discussion || activeAnnotationRef.current === discussion.id)
      ) {
        setActiveAnnotation(id);
      }
      return true;
    } catch (error) {
      setRequestError({
        id: target,
        message:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "The model request failed. Your question is still here.",
      });
      return false;
    } finally {
      busy.current = false;
      setPendingId(null);
    }
  };
  const visibleAnnotations =
    location.scale === "section" && section
      ? readingAnnotations(notes.annotations, book.id, section)
      : [];
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
  const conversationView = chatSession ? (
    <Suspense fallback={null}>
      <ChatPage
        key={chatSession.id}
        compact={inBook}
        messages={chatSession.messages}
        value={chatSession.draft}
        onChange={(text) => chat.setDraft(chatSession.id, text)}
        attachments={chatSession.draftAttachments}
        onAttachmentsChange={(files) =>
          chat.setDraftAttachments(chatSession.id, files)
        }
        settings={modelSettings}
        pending={chat.pendingSessionId === chatSession.id}
        busy={
          chat.busy ||
          pendingId !== null ||
          chatSession.request?.status === "pending"
        }
        error={chatSession.request?.error || chat.error || undefined}
        onSettings={() => navigate({ scale: "settings" })}
        onConfigure={() => navigate({ scale: "settings" })}
        onSend={sendOrdinaryQuestion}
        onRetry={
          chatSession.request && chatSession.request.status !== "pending"
            ? () => {
                if (!configured) {
                  navigate({ scale: "settings" });
                  return;
                }
                void chat.retry(
                  chatSession.id,
                  chatSession.bookId ? book : undefined,
                  {
                    ...chatSession.request!.options,
                    model: promptChoices(modelSettings).models.some(
                      (model) =>
                        model.id === chatSession.request!.options.model,
                    )
                      ? chatSession.request!.options.model
                      : modelSettings.model,
                  },
                );
              }
            : undefined
        }
      />
    </Suspense>
  ) : null;
  return (
    <SidebarProvider
      className="desktop-app"
      mobileBreakpoint={annotationPaneVisible ? 1180 : 768}
      style={{ "--sidebar-width": "256px" } as React.CSSProperties}
    >
      <LibrarySidebar
        book={book}
        location={location}
        onNavigate={navigate}
        onSearch={() => setSearchOpen(true)}
        showContents={location.scale !== "chat" || !!chatSession?.bookId}
      />
      <SidebarInset className="reader-workspace">
        <header
          className="app-topbar flex items-center justify-between gap-4"
          data-tauri-drag-region
        >
          <div className="flex min-w-0 items-center gap-1">
            <SidebarReopenButton />
            <IconButton
              label="Go back"
              disabled={!history.length}
              onClick={() => moveHistory("back")}
            >
              <ArrowLeft />
            </IconButton>
            <IconButton
              label="Go forward"
              disabled={!future.length}
              onClick={() => moveHistory("forward")}
            >
              <ArrowRight />
            </IconButton>
            {(inBook || chatSession) && (
              <div className="ml-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {chatSession
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
            className="flex min-w-8 items-center justify-end gap-1"
            data-tauri-drag-region
          >
            {location.scale === "library" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewBookOpen(true)}
              >
                <Plus />
                New book
              </Button>
            )}
            {location.scale === "chat" && chatSession?.bookId && (
              <IconButton label="Read book" onClick={() => openBook(book)}>
                <BookOpen />
              </IconButton>
            )}
            {location.scale === "section" && (
              <IconButton
                label={
                  annotationsOpen ? "Hide annotations" : "Show annotations"
                }
                aria-pressed={annotationsOpen}
                variant={annotationsOpen ? "secondary" : "ghost"}
                aria-controls="annotation-panel"
                onClick={() => {
                  setPreviewAnnotation(null);
                  setAnnotationsOpen((open) => !open);
                }}
              >
                <MessageSquare />
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
        {notes.error && (
          <Alert
            variant="destructive"
            className="rounded-none border-x-0 border-t-0"
          >
            <AlertDescription className="flex items-center justify-between gap-3">
              {notes.error}
              <Button variant="outline" size="sm" onClick={notes.retry}>
                {notes.errorKind === "save" ? "Retry saving" : "Retry loading"}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div
          className={`reading-split ${annotationPaneVisible ? "" : "annotations-closed"}`}
        >
          {location.scale === "home" ? (
            <HomePage
              value={chat.homeDraft}
              onChange={chat.setHomeDraft}
              attachments={chat.homeAttachments}
              onAttachmentsChange={chat.setHomeAttachments}
              settings={modelSettings}
              pending={false}
              busy={chat.busy || pendingId !== null}
              error={chat.error || recent.error || undefined}
              onSettings={() => navigate({ scale: "settings" })}
              onConfigure={() => navigate({ scale: "settings" })}
              onSend={sendOrdinaryQuestion}
              recentBooks={recentBooks}
              onResume={resumeLearning}
            />
          ) : location.scale === "chat" ? (
            chatSession ? (
              conversationView
            ) : (
              <section
                className="p-6 text-sm text-muted-foreground"
                aria-label="Conversation unavailable"
              >
                This conversation could not be loaded. Open Home to continue.
              </section>
            )
          ) : location.scale === "library" ? (
            <LibraryPage books={library.books} onOpen={openBook} />
          ) : location.scale === "settings" ? (
            <SettingsPage
              settings={modelSettings}
              loadError={modelLoadError}
              onSave={saveModel}
            />
          ) : location.scale === "book" || !chapter || !section ? (
            <EmptyBook book={book} />
          ) : (
            <Suspense fallback={null}>
              <ReadingDocument
                book={book}
                chapter={chapter}
                section={section}
                annotations={notes.annotations}
                activeAnnotationId={activeAnnotation}
                previewAnnotationId={previewAnnotation}
                annotationFocusRequest={annotationFocusRequest}
                onAskAI={compose}
                onSelectAnnotation={(id) => {
                  const annotation = notes.annotations.find(
                    (item) => item.id === id,
                  );
                  if (annotation) selectAnnotation(annotation);
                }}
                onSelectAnnotations={selectAnnotations}
                onNavigate={(chapterId, sectionId) =>
                  navigate({
                    scale: "section",
                    bookId: book.id,
                    chapterId,
                    sectionId,
                  })
                }
              />
            </Suspense>
          )}
          {location.scale === "section" && (
            <Suspense fallback={null}>
              <AnnotationPane
                annotations={visibleAnnotations}
                open={annotationPaneVisible}
                scope={`${book.id}:${section?.id}`}
                selectedId={activeAnnotation}
                selection={annotationSelection}
                composer={
                  composer?.anchor.bookId === book.id &&
                  composer.anchor.sectionId === section?.id
                    ? composer
                    : null
                }
                draft={draft}
                onDraft={setDraft}
                attachments={questionAttachments}
                onAttachments={setQuestionAttachments}
                discussionDrafts={discussionDrafts}
                onDiscussionDraft={(id, update) =>
                  setDiscussionDrafts((previous) => ({
                    ...previous,
                    [id]: {
                      ...(previous[id] ?? { text: "", attachments: [] }),
                      ...update,
                    },
                  }))
                }
                scrollPositions={annotationScrollPositions.current}
                onCancel={() => {
                  setComposer(null);
                  setDraft("");
                  setQuestionAttachments([]);
                  setRequestError(null);
                }}
                onBack={() => {
                  setActiveAnnotation(null);
                  setPreviewAnnotation(null);
                }}
                onAll={() => {
                  setActiveAnnotation(null);
                  setAnnotationSelection(null);
                  setPreviewAnnotation(null);
                }}
                onPreview={setPreviewAnnotation}
                onSelect={(annotation) =>
                  selectAnnotation(annotation, true, true)
                }
                onLocate={() =>
                  setAnnotationFocusRequest((request) => request + 1)
                }
                settings={modelSettings}
                onSettings={() => navigate({ scale: "settings" })}
                pendingId={pendingId}
                requestError={requestError}
                onAsk={(submission) =>
                  composer
                    ? sendQuestion(composer.anchor, draft, submission)
                    : Promise.resolve(false)
                }
                onFollowUp={(annotation, question, submission) =>
                  sendQuestion(
                    annotation.anchor,
                    question,
                    submission,
                    annotation,
                  )
                }
              />
            </Suspense>
          )}
        </div>
      </SidebarInset>
      {inBook && (
        <FloatingConversation
          bookTitle={book.title}
          annotationsOpen={annotationPaneVisible}
          hasMessages={!!chatSession?.messages.length}
          open={conversationOpen}
          onOpenChange={openConversation}
        >
          {conversationView}
        </FloatingConversation>
      )}
      <NewBookDialog
        open={newBookOpen}
        onOpenChange={setNewBookOpen}
        onCreate={(title) => {
          const created = library.createBook(title);
          navigate({ scale: "book", bookId: created.id });
          setNewBookOpen(false);
        }}
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
