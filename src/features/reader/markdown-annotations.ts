import type { Element, Root, Text } from "hast";

export interface MarkdownHighlight {
  id: string;
  quote: string;
  question?: string;
}

interface HighlightOptions {
  highlights: readonly MarkdownHighlight[];
  activeId: string | null;
}

// Work on rendered text, so a quote can span emphasis and inline code.
export function rehypeAnnotations({ highlights, activeId }: HighlightOptions) {
  return (tree: Root) => {
    const leaves: { node: Text; start: number }[] = [];
    let text = "";
    const collect = (parent: Root | Element) => {
      for (const child of parent.children) {
        if (child.type === "text") {
          leaves.push({ node: child, start: text.length });
          text += child.value;
        } else if (child.type === "element") collect(child);
      }
    };
    collect(tree);
    const ranges = highlights
      .filter((highlight) => highlight.quote.length > 0)
      .map((highlight) => ({
        ...highlight,
        start: text.indexOf(highlight.quote),
      }))
      .filter((highlight) => highlight.start >= 0);
    const boundaries = new Map<
      number,
      { starting: number[]; ending: number[] }
    >();
    for (const [index, range] of ranges.entries()) {
      const end = range.start + range.quote.length;
      for (const position of [range.start, end]) {
        if (!boundaries.has(position))
          boundaries.set(position, { starting: [], ending: [] });
      }
      boundaries.get(range.start)!.starting.push(index);
      boundaries.get(end)!.ending.push(index);
    }
    const segments: { start: number; end: number; ids: string[] }[] = [];
    const activeRanges = new Set<number>();
    let previous = 0;
    for (const [position, boundary] of [...boundaries].sort(
      ([left], [right]) => left - right,
    )) {
      if (activeRanges.size > 0 && position > previous) {
        // Preserve input order so the default annotation is stable across selection.
        const ids = [
          ...new Set(
            [...activeRanges]
              .sort((left, right) => left - right)
              .map((index) => ranges[index].id),
          ),
        ];
        segments.push({ start: previous, end: position, ids });
      }
      for (const index of boundary.ending) activeRanges.delete(index);
      for (const index of boundary.starting) activeRanges.add(index);
      previous = position;
    }
    const offsets = new Map(leaves.map((leaf) => [leaf.node, leaf.start]));
    const apply = (parent: Root | Element) => {
      for (let index = parent.children.length - 1; index >= 0; index--) {
        const child = parent.children[index];
        if (child.type === "element") apply(child);
        if (child.type !== "text") continue;
        const offset = offsets.get(child)!;
        let cursor = 0;
        const parts: (Text | Element)[] = [];
        for (const segment of segments) {
          const start = Math.max(0, segment.start - offset);
          const end = Math.min(child.value.length, segment.end - offset);
          if (end <= start) continue;
          if (start > cursor)
            parts.push({
              type: "text",
              value: child.value.slice(cursor, start),
            });
          parts.push({
            type: "element",
            tagName: "mark",
            properties: {
              dataAnnotationIds: JSON.stringify(segment.ids),
              dataAnnotationId:
                activeId && segment.ids.includes(activeId)
                  ? activeId
                  : segment.ids[0],
              className:
                activeId && segment.ids.includes(activeId)
                  ? ["active-highlight"]
                  : [],
            },
            children: [{ type: "text", value: child.value.slice(start, end) }],
          });
          cursor = end;
        }
        if (cursor < child.value.length)
          parts.push({ type: "text", value: child.value.slice(cursor) });
        parent.children.splice(index, 1, ...parts);
      }
    };
    apply(tree);
  };
}
