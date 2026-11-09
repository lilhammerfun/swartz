import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import { TooltipHint } from "./tooltip";
import { LoadingSpinner } from "./feedback";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border border-transparent font-medium outline-none select-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        surface: "border-input bg-background text-foreground hover:bg-accent",
        outline: "border-input bg-background text-foreground hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent aria-expanded:bg-accent",
        navigation: "navigation-control text-foreground",
        destructive: "bg-destructive text-white hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      shape: { default: "", pill: "rounded-full" },
      size: {
        default: "h-9 px-4 py-2",
        navigation: "",
        xs: "h-6 gap-1 px-2",
        sm: "h-8 px-3",
        lg: "h-10 px-8",
        icon: "size-9 p-0",
        "icon-xs": "size-6 p-0",
        "icon-sm": "size-8 p-0",
        "icon-lg": "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  shape,
  type = "button",
  asChild = false,
  loading = false,
  disabled,
  title,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  const resolvedShape =
    shape ??
    (!size?.startsWith("icon") &&
    variant !== "navigation" &&
    variant !== "link" &&
    props["aria-haspopup"] !== "listbox"
      ? "pill"
      : "default");

  const control = (
    <Comp
      {...props}
      aria-label={
        props["aria-label"] ??
        (title && !props["aria-labelledby"] ? title : undefined)
      }
      aria-busy={loading || props["aria-busy"] || undefined}
      disabled={disabled || loading}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-shape={resolvedShape}
      type={asChild ? undefined : type}
      className={cn(
        buttonVariants({ variant, size, shape: resolvedShape, className }),
      )}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <LoadingSpinner label="" /> : null}
          {children}
        </>
      )}
    </Comp>
  );
  return title ? <TooltipHint content={title}>{control}</TooltipHint> : control;
}

export { Button, buttonVariants };
