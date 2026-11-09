import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useGroupRef } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

/** Keep the reader mounted while opening, closing or resizing the conversation. */
export function ReaderSplit({
  children,
  panel,
  onPanelWidthChange,
}: {
  children: ReactNode;
  panel: ReactNode;
  onPanelWidthChange: (width: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const groupRef = useGroupRef();
  const savedWidth = useRef(40);
  const open = !!panel;
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setNarrow(element.clientWidth <= 720);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    // Panel registration updates its constraints during layout effects. Apply one
    // group layout after registration so a breakpoint cannot reuse the old minimums.
    const frame = requestAnimationFrame(() => {
      const conversation = !open ? 0 : narrow ? 100 : savedWidth.current;
      groupRef.current?.setLayout({ reader: 100 - conversation, conversation });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, narrow]);

  return (
    <div
      ref={container}
      className="reader-split-container"
      data-conversation-open={open}
      data-narrow={narrow}
    >
      <ResizablePanelGroup
        groupRef={groupRef}
        orientation="horizontal"
        className="reader-resizable"
        onLayoutChanged={(layout, meta) => {
          if (
            meta.isUserInteraction &&
            open &&
            !narrow &&
            layout.conversation > 0
          )
            savedWidth.current = (meta.requestedLayout ?? layout).conversation;
        }}
      >
        <ResizablePanel
          id="reader"
          defaultSize="100%"
          minSize={narrow ? "0%" : "320px"}
          className="reader-content-panel"
          inert={narrow && open ? true : undefined}
        >
          {children}
        </ResizablePanel>
        <ResizableHandle
          aria-label="Resize conversation"
          disabled={!open || narrow}
          className="session-resize-handle"
          style={{ display: open && !narrow ? undefined : "none" }}
        />
        <ResizablePanel
          id="conversation"
          defaultSize="0%"
          minSize={narrow ? "0%" : "320px"}
          maxSize={narrow ? "100%" : "65%"}
          collapsible={!open || narrow}
          collapsedSize="0%"
          className="conversation-content-panel"
          onResize={(size) => {
            if (open && !narrow && size.inPixels > 0)
              onPanelWidthChange(size.inPixels + 1);
          }}
        >
          {panel}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
