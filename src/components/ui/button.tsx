import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,box-shadow,opacity] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground hover:bg-accent-hover shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset]",
        default:
          "border border-border-strong bg-surface-raised text-foreground hover:bg-surface-hover hover:border-subtle-foreground",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-raised hover:border-border-strong",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-surface-raised hover:text-foreground",
        danger:
          "border border-transparent bg-[rgba(192,57,57,0.1)] text-danger hover:bg-[rgba(192,57,57,0.16)]",
        link: "text-accent underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem]",
        default: "h-9 px-4",
        lg: "h-11 px-6 text-[0.9375rem]",
        icon: "size-9 p-0",
        iconSm: "size-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
