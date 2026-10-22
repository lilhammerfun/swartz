import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnnotationHighlight } from "./AnnotationHighlight";
import type { AnnotationSelection } from "@/features/annotations/annotation-selection";

import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockLine,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import type { Element, RootContent } from "hast";
import {
  rehypeAnnotations,
  type MarkdownHighlight,
} from "./markdown-annotations";

interface MarkdownBlockProps {
  source: string;
  codeLanguage?: string;
  highlights: readonly MarkdownHighlight[];
  activeId: string | null;
  onSelectAnnotation: (id: string) => void;
  onSelectAnnotations?: (selection: AnnotationSelection) => void;
}

function nodeText(node: RootContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(nodeText).join("") : "";
}

function BookCode({
  code,
  language = "text",
}: {
  code: string;
  language?: string;
}) {
  const lines = useHighlightedCode(code, language);
  return (
    <CodeBlock className="book-code bg-muted/25" size="sm">
      <CodeBlockContent>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}

export function MarkdownBlock({
  source,
  codeLanguage,
  highlights,
  activeId,
  onSelectAnnotation,
  onSelectAnnotations,
}: MarkdownBlockProps) {
  if (codeLanguage)
    return (
      <div className="markdown-block">
        <BookCode code={source} language={codeLanguage} />
      </div>
    );
  return (
    <div className="markdown-block">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeAnnotations, { highlights, activeId }]]}
        components={{
          mark: ({ node, children, ...props }) => {
            let ids: string[] = [];
            try {
              const parsed: unknown = JSON.parse(
                String(node?.properties.dataAnnotationIds ?? "[]"),
              );
              if (Array.isArray(parsed))
                ids = parsed.filter(
                  (id): id is string => typeof id === "string",
                );
            } catch {
              /* Unknown historical highlights remain readable. */
            }
            return (
              <AnnotationHighlight
                {...props}
                className={node?.properties.className?.toString()}
                annotations={highlights.filter((highlight) =>
                  ids.includes(highlight.id),
                )}
                activeId={activeId}
                onSelect={onSelectAnnotation}
                onSelectAnnotations={onSelectAnnotations}
                passage={node ? nodeText(node) : ""}
              >
                {children}
              </AnnotationHighlight>
            );
          },
          pre: ({ node }) => {
            const code = node?.children.find(
              (child): child is Element =>
                child.type === "element" && child.tagName === "code",
            );
            const language = /language-([^ ]+)/.exec(
              String(code?.properties.className ?? ""),
            )?.[1];
            return (
              <BookCode
                code={code ? nodeText(code).replace(/\n$/, "") : ""}
                language={language}
              />
            );
          },
        }}
      >
        {source}
      </Markdown>
    </div>
  );
}
