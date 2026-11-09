import { Check } from "./icons";
import { cn } from "cn";

/** Shared interactive card; selection keeps native button keyboard behavior. */
export function EntityCard({
  title,
  description,
  icon,
  selected,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "title" | "children"> & {
  title: string;
  description?: string;
  icon: React.ReactNode;
  selected?: boolean;
}) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={selected}
      data-slot="entity-card"
      className={cn("entity-card", className)}
    >
      <span className="entity-card-header">
        <span className="entity-card-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="entity-card-title">{title}</span>
      </span>
      {description && (
        <span className="entity-card-description">{description}</span>
      )}
      {selected !== undefined && (
        <span
          className="entity-card-check"
          data-checked={selected}
          aria-hidden="true"
        >
          {selected && <Check />}
        </span>
      )}
    </button>
  );
}
