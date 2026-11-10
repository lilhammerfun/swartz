import { Toc, useToc } from "@ark-ui/react/toc";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface OutlineHeading {
  element: HTMLElement;
  value: string;
  title: string;
  depth: number;
}

const outlineWidth = 240;
const viewportSelector = '[data-slot="scroll-area-viewport"]';
// Leave a readable document column and its existing insets beside the outline.
const minimumInsideWidth = outlineWidth + 360 + 56;

export function DocumentOutline({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
}) {
  const scope = useId();
  const nextId = useRef(0);
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);
  const [side, setSide] = useState<"left" | "right">("left");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Use rendered Markdown so inline formatting and code samples are interpreted
    // exactly as they are in the reader. Generated IDs also distinguish equal titles.
    const collect = () => {
      const next = [
        ...container.querySelectorAll<HTMLElement>(
          ".reading-document :is(h1, h2, h3, h4, h5, h6)",
        ),
      ]
        .map((element) => {
          if (!element.id) element.id = `outline-${scope}-${nextId.current++}`;
          return {
            element,
            value: element.id,
            title: element.textContent?.trim() ?? "",
            depth: Number(element.tagName.slice(1)),
          };
        })
        .filter((heading) => heading.title);
      setHeadings((current) =>
        current.length === next.length &&
        current.every(
          (heading, index) =>
            heading.element === next[index].element &&
            heading.title === next[index].title &&
            heading.depth === next[index].depth,
        )
          ? current
          : next,
      );
    };
    const measure = () =>
      setSide(
        container.clientWidth >= minimumInsideWidth ||
          container.getBoundingClientRect().left < outlineWidth + 16
          ? "right"
          : "left",
      );
    collect();
    measure();
    const mutations = new MutationObserver(collect);
    mutations.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const resize = new ResizeObserver(measure);
    resize.observe(container);
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, [containerRef, scope]);

  const viewport = headings[0]?.element.closest<HTMLElement>(viewportSelector);
  return headings.length && viewport ? (
    <OutlineNavigation
      key={headings[0].value}
      headings={headings}
      viewport={viewport}
      side={side}
    />
  ) : null;
}

function OutlineNavigation({
  headings,
  viewport,
  side,
}: {
  headings: OutlineHeading[];
  viewport: HTMLElement;
  side: "left" | "right";
}) {
  const toc = useToc({
    items: headings,
    scrollEl: () => viewport,
    multiple: false,
    autoScroll: false,
  });
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const openedByHover = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const closeLater = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!content.current?.contains(document.activeElement)) setOpen(false);
    }, 180);
  };
  useEffect(() => cancelClose, []);
  const minimumDepth = Math.min(...headings.map((heading) => heading.depth));

  return (
    <Toc.RootProvider
      value={toc}
      className="document-outline-rail"
      style={{ height: Math.max(28, headings.length * 21) }}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          cancelClose();
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="document-outline-trigger"
            aria-label="Document outline"
            onPointerEnter={(event) => {
              if (event.pointerType === "touch") return;
              cancelClose();
              openedByHover.current = true;
              setOpen(true);
            }}
            onPointerDown={() => {
              openedByHover.current = false;
            }}
            onKeyDown={() => {
              openedByHover.current = false;
            }}
            onPointerLeave={closeLater}
          >
            {headings.map((heading) => (
              <span
                key={heading.value}
                aria-hidden="true"
                className="document-outline-mark"
                data-active={toc.activeIds.includes(heading.value)}
              >
                <span
                  style={{ width: heading.depth === minimumDepth ? 14 : 9 }}
                />
              </span>
            ))}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          ref={content}
          className="document-outline-popover"
          style={{ width: outlineWidth }}
          side={side}
          align="center"
          sideOffset={8}
          collisionPadding={8}
          onPointerEnter={cancelClose}
          onPointerLeave={closeLater}
          onFocusCapture={cancelClose}
          onOpenAutoFocus={(event) => {
            // Hover must not take focus away from the conversation composer.
            if (openedByHover.current) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            if (openedByHover.current) event.preventDefault();
          }}
        >
          <Toc.Nav
            aria-label="Document outline"
            className="document-outline-navigation"
          >
            <Toc.Title className="px-2 pb-2 text-xs text-muted-foreground">
              On this page
            </Toc.Title>
            <Toc.List className="space-y-0.5">
              {headings.map((heading) => (
                <Toc.Item key={heading.value} item={heading}>
                  <Toc.Link
                    href={`#${heading.value}`}
                    className="document-outline-link"
                    style={{
                      paddingLeft: 8 + (heading.depth - minimumDepth) * 12,
                    }}
                    onClickCapture={(event) => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey ||
                        event.button !== 0
                      )
                        return;
                      // Keep section navigation inside the reader, without changing
                      // the conversation URL or scrolling its composer.
                      event.preventDefault();
                      toc.scrollTo(heading.value, {
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "instant"
                          : "smooth",
                      });
                      cancelClose();
                      setOpen(false);
                    }}
                  >
                    {heading.title}
                  </Toc.Link>
                </Toc.Item>
              ))}
            </Toc.List>
          </Toc.Nav>
        </PopoverContent>
      </Popover>
    </Toc.RootProvider>
  );
}
