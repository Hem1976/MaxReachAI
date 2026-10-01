import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-surface-raised px-3 py-1 text-sm text-foreground transition-[border-color,box-shadow] duration-150 outline-none",
        "placeholder:text-subtle-foreground",
        "hover:border-border-strong",
        "focus-visible:border-[var(--accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--accent-soft)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-[var(--danger)] aria-invalid:ring-[3px] aria-invalid:ring-[rgba(229,84,75,0.15)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
