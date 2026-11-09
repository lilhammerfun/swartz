import { useId, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "cn";
import { CircleAlert, Inbox, LoaderCircle } from "./icons";

export function EmptyState({
  title,
  children,
  compact = false,
  icon = <Inbox />,
  ...props
}: {
  title?: string;
  children: ReactNode;
  compact?: boolean;
  icon?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "empty-state",
        compact && "empty-state--compact",
        props.className,
      )}
    >
      {icon && (
        <span className="empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {title && <p className="empty-state-title">{title}</p>}
      <div className="empty-state-description">{children}</div>
    </div>
  );
}

export function RuntimeErrorNotice({
  title,
  children,
  action,
  className,
  ...props
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const id = useId();
  return (
    <div
      role="alert"
      {...props}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className={cn("runtime-error-notice", className)}
    >
      <CircleAlert aria-hidden="true" />
      <div className="runtime-error-copy">
        <p id={`${id}-title`}>{title}</p>
        <div id={`${id}-description`}>{children}</div>
        {action && <div className="runtime-error-action">{action}</div>}
      </div>
    </div>
  );
}

export function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span className="loading-spinner" role={label ? "status" : undefined}>
      <LoaderCircle className="animate-spin" aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
