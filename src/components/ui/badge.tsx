import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium tracking-wide whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-raised text-muted-foreground",
        accent: "border-[rgba(32,164,184,0.35)] bg-accent-soft text-accent",
        success: "border-[rgba(31,138,92,0.28)] bg-[rgba(31,138,92,0.1)] text-success",
        warning: "border-[rgba(148,100,0,0.28)] bg-[rgba(148,100,0,0.1)] text-warning",
        danger: "border-[rgba(192,57,57,0.28)] bg-[rgba(192,57,57,0.1)] text-danger",
        outline: "border-border-strong bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
