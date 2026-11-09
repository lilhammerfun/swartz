import { IconButton } from "./IconButton";
import { X } from "./icons";

export function CloseButton({
  label = "Close",
  className,
  ...props
}: Omit<React.ComponentProps<typeof IconButton>, "label" | "children"> & {
  label?: string;
}) {
  return (
    <IconButton
      label={label}
      className={`close-button ${className ?? ""}`}
      {...props}
    >
      <X />
    </IconButton>
  );
}
