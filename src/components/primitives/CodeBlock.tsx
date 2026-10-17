import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../atoms/Button";
import { Copy } from "iconoir-react";
const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "default",
  "async",
  "function",
  "const",
  "let",
  "var",
  "await",
  "return",
  "if",
  "else",
  "for",
  "while",
  "new",
  "throw",
  "try",
  "catch",
  "null",
  "true",
  "false",
  "undefined",
]);
const TOKEN =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b(?:import|from|export|default|async|function|const|let|var|await|return|if|else|for|while|new|throw|try|catch|null|true|false|undefined)\b|[A-Za-z_$][\w$]*(?=\s*\())/g;

function highlight(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    const t = m[0];
    if (idx > last) nodes.push(<span key={k++}>{text.slice(last, idx)}</span>);
    let color: string;
    let weight: number | undefined;
    if (/^["'`]/.test(t) || /^\d/.test(t))
      color = "var(--orange)"; // string / number
    else if (KEYWORDS.has(t))
      color = "var(--accent-ink)"; // keyword / import / conditional
    else {
      color = "var(--ink)";
      weight = 500;
    } // function call
    nodes.push(
      <span key={k++} style={{ color, fontWeight: weight }}>
        {t}
      </span>,
    );
    last = idx + t.length;
  }
  if (last < text.length) nodes.push(<span key={k++}>{text.slice(last)}</span>);
  return nodes;
}

export default function CodeBlock({
  filename,
  lines,
  labels,
}: {
  filename: string;
  lines: string[];
  labels?: { copy: string; copied: string };
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 1500);
  };
  return (
    <div className="w-full overflow-hidden rounded-card bg-surface shadow-card">
      <header className="flex h-11 items-center gap-2 border-b border-line px-4 text-[12px]">
        <span className="min-w-0 flex-1 truncate font-mono text-ink">
          {filename}
        </span>
        <Button
          variant="quiet"
          size="xs"
          aria-label="复制代码"
          onClick={() => void copy()}
        >
          <Copy width={13} height={13} />
          {status === "copied"
            ? (labels?.copied ?? "已复制")
            : status === "failed"
              ? "复制失败"
              : (labels?.copy ?? "复制代码")}
        </Button>
      </header>
      <pre className="overflow-x-auto py-3 text-[11.5px] leading-6">
        <code>
          {lines.map((line, index) => (
            <span key={index} className="flex px-3">
              <span
                aria-hidden
                className="mr-3 w-5 shrink-0 select-none text-right text-ink-3"
              >
                {index + 1}
              </span>
              <span>{highlight(line)}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
