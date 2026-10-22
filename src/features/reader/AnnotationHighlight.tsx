import type { ComponentProps } from "react";
import { annotationColorStyle } from "@/features/annotations/annotation-colors";
import type { AnnotationSelection } from "@/features/annotations/annotation-selection";
import type { MarkdownHighlight } from "./markdown-annotations";

export function AnnotationHighlight({
  annotations,
  activeId,
  onSelect,
  onSelectAnnotations,
  passage,
  children,
  className,
  style,
  ...props
}: Omit<ComponentProps<"mark">, "onSelect"> & {
  annotations: readonly MarkdownHighlight[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onSelectAnnotations?: (selection: AnnotationSelection) => void;
  passage: string;
}) {
  if (!annotations.length)
    return (
      <mark {...props} className={className} style={style}>
        {children}
      </mark>
    );
  const ids = [...new Set(annotations.map((annotation) => annotation.id))];
  const selected = !!activeId && ids.includes(activeId);
  const colorId = selected ? activeId! : ids[0];
  const choose = () => {
    if (ids.length > 1 && onSelectAnnotations) {
      onSelectAnnotations({ ids, passage, scope: "passage" });
    } else {
      onSelect(selected ? activeId! : ids[0]);
    }
  };
  return (
    <mark
      {...props}
      className={`annotation-source-highlight${className ? ` ${className}` : ""}`}
      style={{ ...style, ...annotationColorStyle(colorId) }}
      data-annotation-id={colorId}
      data-annotation-ids={JSON.stringify(ids)}
      data-active={selected}
      data-overlap={ids.length > 1}
      role="button"
      tabIndex={0}
      aria-label={
        ids.length > 1
          ? `Choose from ${ids.length} questions on “${passage}”`
          : `Open question: ${annotations[0].question ?? annotations[0].quote}`
      }
      onClick={(event) => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) return;
        event.preventDefault();
        choose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          choose();
        }
      }}
    >
      {children}
    </mark>
  );
}
