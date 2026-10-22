import { forwardRef } from "react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { label: string }
>(
  (
    {
      label,
      children,
      variant = "ghost",
      size = "icon-sm",
      type = "button",
      ...props
    },
    ref,
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          type={type}
          aria-label={label}
          variant={variant}
          size={size}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  ),
);
IconButton.displayName = "IconButton";
