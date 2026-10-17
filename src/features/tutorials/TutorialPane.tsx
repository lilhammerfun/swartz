import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/atoms/Button";
import { StatusPill } from "../../components/atoms/StatusPill";
import CodeBlock from "../../components/primitives/CodeBlock";
import GlideMenu from "../../components/primitives/GlideMenu";
import SelectionActions from "../../components/primitives/SelectionActions";
import { ArrowLeft, BookOpen } from "../../components/TukdamIcons";
import type { Tutorial, Quote } from "../../types/workspace";

export function TutorialPane({
  tutorials,
  target,
  onQuote,
  onSource,
  onRetry,
}: {
  tutorials: Tutorial[];
  target: { id: string; chapterId?: string } | null;
  onQuote: (quote: Quote) => void;
  onSource: (id: string, messageId: string) => void;
  onRetry: (id: string) => void;
}) {
  const [tutorialId, setTutorialId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  useEffect(() => {
    setTutorialId(target?.id ?? null);
    setChapterId(target?.chapterId ?? null);
  }, [target]);
  const reader = useRef<HTMLElement>(null);
  const tutorial = tutorials.find((item) => item.id === tutorialId);
  const chapter =
    tutorial?.chapters.find((item) => item.id === chapterId) ??
    tutorial?.chapters[0];
  if (!tutorial || !chapter)
    return (
      <GlideMenu
        className="tutorial-library"
        rowSelector="button"
        highlightClassName="inset-x-0 rounded-[10px] bg-hover-2"
      >
        {tutorials.map((item) => (
          <Button
            key={item.id}
            variant="quiet"
            size="xs"
            className="tutorial-row"
            onClick={() => {
              setTutorialId(item.id);
              setChapterId(item.chapters[0]?.id ?? null);
            }}
          >
            <BookOpen size={18} />
            <span>
              <strong>{item.title}</strong>
              <span>{item.chapters.length} 章</span>
            </span>
            {item.status === "failed" && (
              <StatusPill tone="orange" dot={false}>
                更新未完成
              </StatusPill>
            )}
          </Button>
        ))}
        {!tutorials.length && (
          <p className="pane-empty">项目中的完整讲解会整理成教程。</p>
        )}
      </GlideMenu>
    );
  const quote = (text: string, messageIds = [chapter.sourceMessageId]) =>
    onQuote({
      tutorialId: tutorial.id,
      chapterId: chapter.id,
      version: chapter.version,
      text,
      sourceThreadId: chapter.sourceThreadId,
      sourceMessageId: messageIds[0] ?? chapter.sourceMessageId,
      sourceMessageIds: messageIds,
    });
  return (
    <div className="tutorial-reader">
      <header className="reader-toolbar">
        <Button
          variant="quiet"
          size="xs"
          aria-label="返回教程列表"
          onClick={() => setTutorialId(null)}
        >
          <ArrowLeft size={15} />
        </Button>
        <span>{tutorial.title}</span>
        <span className="reader-version">v{chapter.version}</span>
      </header>
      <nav className="reader-toc" aria-label="教程目录">
        <GlideMenu
          rowSelector="button"
          highlightClassName="inset-x-0 rounded-[7px] bg-hover-2"
        >
          {tutorial.chapters.map((item) => (
            <Button
              variant="quiet"
              size="xs"
              key={item.id}
              className={item.id === chapter.id ? "is-active" : ""}
              aria-current={item.id === chapter.id ? "page" : undefined}
              onClick={() => {
                setChapterId(item.id);
                reader.current?.scrollTo({ top: 0 });
              }}
            >
              {item.title}
            </Button>
          ))}
        </GlideMenu>
      </nav>
      {tutorial.status === "failed" && (
        <div className="reader-notice">
          <span>更新未完成，上一版本仍可阅读。</span>
          <Button
            variant="quiet"
            size="xs"
            onClick={() => onRetry(tutorial.id)}
          >
            重试整理
          </Button>
        </div>
      )}
      <article ref={reader} className="reader-content">
        <h2>{chapter.title}</h2>
        {chapter.paragraphs.map((text, index) => (
          <p
            key={index}
            data-source-message={
              chapter.paragraphSources?.[index] ?? chapter.sourceMessageId
            }
          >
            {text}
          </p>
        ))}
        {chapter.code.length > 0 && (
          <div
            data-source-message={
              chapter.codeSourceMessageId ?? chapter.sourceMessageId
            }
          >
            <CodeBlock
              filename={chapter.filename}
              lines={chapter.code}
              labels={{ copy: "复制代码", copied: "已复制" }}
            />
          </div>
        )}
        <footer className="reader-source">
          <Button
            variant="quiet"
            size="xs"
            onClick={() =>
              onSource(chapter.sourceThreadId, chapter.sourceMessageId)
            }
          >
            原对话
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              quote(
                chapter.paragraphs.join("\n\n"),
                chapter.paragraphSources ?? [chapter.sourceMessageId],
              )
            }
          >
            引用本章追问
          </Button>
        </footer>
      </article>
      <SelectionActions container={reader} onQuote={quote} />
    </div>
  );
}
