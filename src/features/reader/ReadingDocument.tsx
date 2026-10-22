import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { annotationColorStyle } from "@/features/annotations/annotation-colors";
import type { AnnotationSelection } from "@/features/annotations/annotation-selection";
import type {
  Annotation,
  AnnotationAnchor,
  BookChapter,
  BookSection,
  LearningBook,
  Paragraph,
} from "../../types/book";
import { IconButton } from "../../components/ui/IconButton";
import { MarkdownBlock } from "./MarkdownBlock";

interface ReadingDocumentProps {
  book: LearningBook;
  chapter: BookChapter;
  section: BookSection;
  annotations: Annotation[];
  activeAnnotationId: string | null;
  previewAnnotationId: string | null;
  annotationFocusRequest: number;
  onAskAI: (anchor: AnnotationAnchor) => void;
  onSelectAnnotation: (id: string) => void;
  onSelectAnnotations: (selection: AnnotationSelection) => void;
  onNavigate: (chapterId: string, sectionId: string) => void;
}

export function ReadingDocument({
  book,
  chapter,
  section,
  annotations,
  activeAnnotationId,
  previewAnnotationId,
  annotationFocusRequest,
  onAskAI,
  onSelectAnnotation,
  onSelectAnnotations,
  onNavigate,
}: ReadingDocumentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const lastFocusRequest = useRef(annotationFocusRequest);
  const [selection, setSelection] = useState<{
    anchor: AnnotationAnchor;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    setSelection(null);
  }, [section.id]);
  useEffect(() => {
    if (
      !activeAnnotationId ||
      lastFocusRequest.current === annotationFocusRequest
    )
      return;
    const annotation = annotations.find((a) => a.id === activeAnnotationId);
    if (
      annotation?.anchor.bookId !== book.id ||
      annotation.anchor.sectionId !== section.id
    )
      return;
    // Only an explicit locate request may move the reader; previews and source clicks do not.
    const frame = requestAnimationFrame(() => {
      const viewport = scrollRef.current;
      const article = articleRef.current;
      const paragraph = article?.querySelector(
        `[data-paragraph-id="${CSS.escape(annotation.anchor.paragraphId)}"]`,
      );
      if (!viewport || !paragraph) return;
      lastFocusRequest.current = annotationFocusRequest;
      const targets = [
        ...paragraph.querySelectorAll(
          `[data-annotation-id="${CSS.escape(activeAnnotationId)}"]`,
        ),
      ];
      const bounds = (targets.length ? targets : [paragraph]).map((target) =>
        target.getBoundingClientRect(),
      );
      const targetTop = Math.min(...bounds.map((rect) => rect.top));
      const targetBottom = Math.max(...bounds.map((rect) => rect.bottom));
      const viewportTop = viewport.getBoundingClientRect().top;
      if (
        targetTop >= viewportTop + 16 &&
        targetBottom <= viewportTop + viewport.clientHeight - 16
      )
        return;
      viewport.scrollTo({
        top: Math.max(0, viewport.scrollTop + targetTop - viewportTop - 32),
        left: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    activeAnnotationId,
    annotationFocusRequest,
    annotations,
    book.id,
    section.id,
  ]);
  const allSections = book.chapters.flatMap((c) =>
    c.sections.map((s) => ({ chapterId: c.id, section: s })),
  );
  const index = allSections.findIndex((item) => item.section.id === section.id);
  const makeAnchor = (p: Paragraph, quote?: string): AnnotationAnchor => ({
    bookId: book.id,
    chapterId: chapter.id,
    sectionId: section.id,
    paragraphId: p.id,
    version: book.version,
    quote:
      quote ??
      (p.kind === "code"
        ? p.text
        : articleRef.current
            ?.querySelector(`[data-paragraph-id="${p.id}"] .markdown-block`)
            ?.textContent?.trim()) ??
      p.text,
  });
  const selectText = () => {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount || !articleRef.current) {
      setSelection(null);
      return;
    }
    const start = s.anchorNode?.parentElement?.closest<HTMLElement>(
      "[data-paragraph-id]",
    );
    const end = s.focusNode?.parentElement?.closest<HTMLElement>(
      "[data-paragraph-id]",
    );
    if (!start || start !== end || !articleRef.current.contains(start)) return;
    const text = s.toString().trim();
    const paragraph = section.paragraphs.find(
      (p) => p.id === start.dataset.paragraphId,
    );
    if (!text || !paragraph || paragraph.kind === "code") return;
    const rect = s.getRangeAt(0).getBoundingClientRect();
    setSelection({
      anchor: makeAnchor(paragraph, text),
      x: Math.max(12, Math.min(rect.left, window.innerWidth - 160)),
      y: Math.max(12, rect.top - 48),
    });
  };
  const askAI = () => {
    if (selection) onAskAI(selection.anchor);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };
  return (
    <ScrollArea
      className="document-scroll"
      viewportRef={scrollRef}
      viewportProps={{ onScroll: () => setSelection(null) }}
    >
      <article
        className="reading-document"
        ref={articleRef}
        onMouseUp={selectText}
        onKeyUp={selectText}
      >
        <header className="document-heading">
          <h1 className="text-[27px] leading-snug font-semibold tracking-tight">
            {section.title}
          </h1>
        </header>
        <div className="document-prose">
          {section.paragraphs.map((paragraph, pIndex) => {
            const paragraphAnnotations = annotations.filter(
              (annotation) =>
                annotation.anchor.bookId === book.id &&
                annotation.anchor.sectionId === section.id &&
                annotation.anchor.paragraphId === paragraph.id,
            );
            return (
              <div
                key={paragraph.id}
                className="paragraph-block"
                data-paragraph-id={paragraph.id}
              >
                <MarkdownBlock
                  source={paragraph.text}
                  codeLanguage={paragraph.kind === "code" ? "rust" : undefined}
                  highlights={paragraphAnnotations.map((annotation) => ({
                    id: annotation.id,
                    quote: annotation.anchor.quote,
                    question: annotation.text,
                  }))}
                  activeId={previewAnnotationId ?? activeAnnotationId}
                  onSelectAnnotation={onSelectAnnotation}
                  onSelectAnnotations={onSelectAnnotations}
                />
                {paragraph.kind !== "code" && (
                  <IconButton
                    className="paragraph-ask"
                    label={`Ask AI about paragraph ${pIndex + 1}`}
                    onClick={() => onAskAI(makeAnchor(paragraph))}
                  >
                    <MessageSquare />
                  </IconButton>
                )}
                {paragraphAnnotations.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="paragraph-annotations"
                    aria-label={`${paragraphAnnotations.length} ${paragraphAnnotations.length === 1 ? "question" : "questions"} on this paragraph`}
                    title={`${paragraphAnnotations.length} ${paragraphAnnotations.length === 1 ? "question" : "questions"} on this paragraph`}
                    style={
                      paragraphAnnotations.length === 1
                        ? annotationColorStyle(paragraphAnnotations[0].id)
                        : undefined
                    }
                    onClick={() => {
                      if (paragraphAnnotations.length === 1) {
                        onSelectAnnotation(paragraphAnnotations[0].id);
                      } else {
                        onSelectAnnotations({
                          ids: paragraphAnnotations.map(
                            (annotation) => annotation.id,
                          ),
                          passage: makeAnchor(paragraph).quote,
                          scope: "paragraph",
                        });
                      }
                    }}
                  >
                    <MessageSquare aria-hidden="true" />
                    {paragraphAnnotations.length}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <nav
          className="chapter-end flex items-center justify-between gap-3"
          aria-label="Reading navigation"
        >
          {index > 0 ? (
            <Button
              variant="ghost"
              className="h-auto min-w-0 gap-3 py-2.5 text-left"
              onClick={() =>
                onNavigate(
                  allSections[index - 1].chapterId,
                  allSections[index - 1].section.id,
                )
              }
            >
              <ArrowLeft className="text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-[11px] font-normal text-muted-foreground">
                  Previous
                </span>
                <span className="mt-1 block truncate text-xs font-normal">
                  {allSections[index - 1].section.title}
                </span>
              </span>
            </Button>
          ) : (
            <div />
          )}
          {index < allSections.length - 1 && (
            <Button
              variant="ghost"
              className="h-auto min-w-0 gap-3 py-2.5 text-right"
              onClick={() =>
                onNavigate(
                  allSections[index + 1].chapterId,
                  allSections[index + 1].section.id,
                )
              }
            >
              <span className="min-w-0">
                <span className="block text-[11px] font-normal text-muted-foreground">
                  Next
                </span>
                <span className="mt-1 block truncate text-xs font-normal">
                  {allSections[index + 1].section.title}
                </span>
              </span>
              <ArrowRight className="text-muted-foreground" />
            </Button>
          )}
        </nav>
      </article>
      {selection &&
        createPortal(
          <Card
            className="selection-actions gap-0 p-1 shadow-lg"
            role="toolbar"
            aria-label="Text selection actions"
            style={{ left: selection.x, top: selection.y }}
            onMouseDown={(event) => event.preventDefault()}
          >
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={askAI}>
                <MessageSquare />
                Ask AI
              </Button>
              <IconButton
                label="Clear selection"
                onClick={() => {
                  setSelection(null);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                <X />
              </IconButton>
            </div>
          </Card>,
          document.body,
        )}
    </ScrollArea>
  );
}
