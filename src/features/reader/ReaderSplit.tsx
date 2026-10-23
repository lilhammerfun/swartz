import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

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
  const layout = useRef<Record<string, number> | undefined>(undefined);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setNarrow(element.clientWidth <= 720);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={container} className="reader-split-container">
      {panel && !narrow ? (
        <ResizablePanelGroup
          orientation="horizontal"
          className="reader-resizable"
          defaultLayout={layout.current}
          onLayoutChanged={(next) => {
            layout.current = next;
          }}
        >
          <ResizablePanel
            id="reader"
            defaultSize="61%"
            minSize="320px"
            className="flex min-h-0 flex-col"
          >
            {children}
          </ResizablePanel>
          <ResizableHandle
            aria-label="Resize session panel"
            className="session-resize-handle"
          />
          <ResizablePanel
            id="sessions"
            defaultSize="39%"
            minSize="320px"
            maxSize="65%"
            className="flex min-h-0 flex-col"
            onResize={(size) => onPanelWidthChange(size.inPixels + 1)}
          >
            {panel}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className={`reading-split ${panel ? "" : "sessions-closed"}`}>
          {children}
          {panel}
        </div>
      )}
    </div>
  );
}
