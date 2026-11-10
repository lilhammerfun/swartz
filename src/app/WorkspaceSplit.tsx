import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useGroupRef } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

/** Keep the main content mounted while opening, closing or resizing the textbook. */
export function WorkspaceSplit({
  children,
  panel,
  onSupportResize,
}: {
  children: ReactNode;
  panel: ReactNode;
  onSupportResize: (width: number) => void;
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
      const support = !open ? 0 : narrow ? 100 : savedWidth.current;
      groupRef.current?.setLayout({ main: 100 - support, support });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, narrow]);

  return (
    <div
      ref={container}
      className="workspace-split"
      data-support-open={open}
      data-narrow={narrow}
    >
      <ResizablePanelGroup
        groupRef={groupRef}
        orientation="horizontal"
        className="workspace-resizable"
        onLayoutChanged={(layout, meta) => {
          if (meta.isUserInteraction && open && !narrow && layout.support > 0)
            savedWidth.current = (meta.requestedLayout ?? layout).support;
        }}
      >
        <ResizablePanel
          id="main"
          defaultSize="100%"
          minSize={narrow ? "0%" : "320px"}
          className="main-content-panel"
          inert={narrow && open ? true : undefined}
        >
          {children}
        </ResizablePanel>
        <ResizableHandle
          aria-label="Resize textbook"
          disabled={!open || narrow}
          className="support-resize-handle"
          style={{ display: open && !narrow ? undefined : "none" }}
        />
        <ResizablePanel
          id="support"
          defaultSize="0%"
          minSize={narrow ? "0%" : "320px"}
          maxSize={narrow ? "100%" : "65%"}
          collapsible={!open || narrow}
          collapsedSize="0%"
          className="support-content-panel"
          onResize={(size) => onSupportResize(size.inPixels)}
        >
          {panel}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
