import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  rehypeAnnotations,
  type MarkdownHighlight,
} from "./markdown-annotations.ts";

function render(
  source: string,
  highlights: MarkdownHighlight[] = [],
  activeId: string | null = "note",
) {
  return renderToStaticMarkup(
    createElement(Markdown, {
      children: source,
      skipHtml: true,
      remarkPlugins: [remarkGfm],
      rehypePlugins: [[rehypeAnnotations, { highlights, activeId }]],
    }),
  );
}

function markedSegments(html: string) {
  return [...html.matchAll(/<mark([^>]*)>([^<]*)<\/mark>/g)].map(
    ([, attributes, text]) => ({
      text,
      ids: JSON.parse(
        attributes
          .match(/data-annotation-ids="([^"]*)"/)![1]
          .replaceAll("&quot;", '"'),
      ),
      primaryId: attributes.match(/data-annotation-id="([^"]*)"/)![1],
      active: attributes.includes("active-highlight"),
    }),
  );
}

test("a visible quote can span bold text and inline code without losing either", () => {
  const html = render("Use a **shared** `reference` carefully.", [
    { id: "note", quote: "shared reference" },
  ]);
  assert.match(html, /<strong><mark[^>]+>shared<\/mark><\/strong>/);
  assert.match(html, /<code><mark[^>]+>reference<\/mark><\/code>/);
  assert.equal((html.match(/data-annotation-id="note"/g) ?? []).length, 3);
  assert.match(html, /active-highlight/);
  assert.equal(
    html.replace(/<[^>]+>/g, ""),
    "Use a shared reference carefully.",
  );
});

test("contained quotes remain accessible and the active annotation owns their shared segment", () => {
  const html = render(
    "A shared reference remains valid.",
    [
      { id: "note", quote: "shared reference" },
      { id: "overlap", quote: "reference" },
      { id: "old", quote: "a quote from an older draft" },
    ],
    "overlap",
  );
  assert.deepEqual(markedSegments(html), [
    {
      text: "shared ",
      ids: ["note"],
      primaryId: "note",
      active: false,
    },
    {
      text: "reference",
      ids: ["note", "overlap"],
      primaryId: "overlap",
      active: true,
    },
  ]);
  assert.equal(
    html.replace(/<[^>]+>/g, ""),
    "A shared reference remains valid.",
  );
  assert.doesNotMatch(html, /data-annotation-id="old"/);
});

test("identical quotes retain every annotation without nested or duplicated marks", () => {
  const html = render(
    "A shared reference remains valid.",
    [
      { id: "note", quote: "shared reference" },
      { id: "second", quote: "shared reference" },
      { id: "third", quote: "shared reference" },
    ],
    "third",
  );
  assert.deepEqual(markedSegments(html), [
    {
      text: "shared reference",
      ids: ["note", "second", "third"],
      primaryId: "third",
      active: true,
    },
  ]);
  assert.equal((html.match(/<mark/g) ?? []).length, 1);
  assert.equal(
    html.replace(/<[^>]+>/g, ""),
    "A shared reference remains valid.",
  );
});

test("partially overlapping quotes split only at coverage boundaries", () => {
  const html = render(
    "alpha beta gamma delta",
    [
      { id: "left", quote: "alpha beta gamma" },
      { id: "right", quote: "beta gamma delta" },
    ],
    null,
  );
  assert.deepEqual(markedSegments(html), [
    { text: "alpha ", ids: ["left"], primaryId: "left", active: false },
    {
      text: "beta gamma",
      ids: ["left", "right"],
      primaryId: "left",
      active: false,
    },
    { text: " delta", ids: ["right"], primaryId: "right", active: false },
  ]);
  assert.equal(html.replace(/<[^>]+>/g, ""), "alpha beta gamma delta");
});

test("adjacent quotes keep independent membership at their shared boundary", () => {
  const html = render("alpha beta", [
    { id: "note", quote: "alpha" },
    { id: "next", quote: " beta" },
  ]);
  assert.deepEqual(markedSegments(html), [
    { text: "alpha", ids: ["note"], primaryId: "note", active: true },
    { text: " beta", ids: ["next"], primaryId: "next", active: false },
  ]);
  assert.equal(html.replace(/<[^>]+>/g, ""), "alpha beta");
});

test("overlapping quotes preserve emphasis and code while sharing annotation membership", () => {
  const html = render(
    "Use a **shared** `reference` carefully.",
    [
      { id: "note", quote: "shared reference" },
      { id: "overlap", quote: "reference carefully" },
    ],
    "overlap",
  );
  assert.match(html, /<strong><mark[^>]+>shared<\/mark><\/strong>/);
  assert.match(html, /<code><mark[^>]+>reference<\/mark><\/code>/);
  assert.deepEqual(markedSegments(html), [
    { text: "shared", ids: ["note"], primaryId: "note", active: false },
    { text: " ", ids: ["note"], primaryId: "note", active: false },
    {
      text: "reference",
      ids: ["note", "overlap"],
      primaryId: "overlap",
      active: true,
    },
    {
      text: " carefully",
      ids: ["overlap"],
      primaryId: "overlap",
      active: true,
    },
  ]);
  assert.equal(
    html.replace(/<[^>]+>/g, ""),
    "Use a shared reference carefully.",
  );
});

test("empty and missing historical quotes leave the reading text untouched", () => {
  const html = render("The revised book text.", [
    { id: "empty", quote: "" },
    { id: "old", quote: "a quote from an older draft" },
  ]);
  assert.doesNotMatch(html, /<mark/);
  assert.equal(html.replace(/<[^>]+>/g, ""), "The revised book text.");
});

test("GFM tables and task lists render while raw HTML and executable URLs stay inert", () => {
  const html = render(
    "| Access | Rule |\n| --- | --- |\n| Shared | Read |\n\n- [x] Review ownership\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))",
  );
  assert.match(html, /<table>/);
  assert.match(html, /type="checkbox" disabled="" checked=""/);
  assert.doesNotMatch(html, /<script|href="javascript:/);
});
