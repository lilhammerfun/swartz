import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router";
import { cn } from "cn";
import { ScrollArea } from "./scroll-area";

const positions = new Map<string, number>();

export function PageToolbar({ children }: { children: ReactNode }) {
  return <div className="page-toolbar">{children}</div>;
}

export function SelectedCount({ count }: { count: number }) {
  return (
    <span className="selected-count" role="status">
      {count} selected
    </span>
  );
}

/** One scroll owner and one content boundary for pages and their feedback states. */
export function PageLayout({
  label,
  className,
  children,
  rememberScroll = true,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  rememberScroll?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigation = useNavigationType();
  const key = location.pathname + location.search;
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !rememberScroll) return;
    element.scrollTop = navigation === "POP" ? (positions.get(key) ?? 0) : 0;
    return () => {
      positions.set(key, element.scrollTop);
    };
  }, [key, rememberScroll]);
  return (
    <ScrollArea
      className="page-scroll"
      aria-label={label}
      viewportRef={viewport}
      viewportProps={{
        onScroll: (event) => {
          if (rememberScroll) positions.set(key, event.currentTarget.scrollTop);
        },
      }}
    >
      <div className={cn("page-content", className)}>{children}</div>
    </ScrollArea>
  );
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="page-heading-copy">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}
