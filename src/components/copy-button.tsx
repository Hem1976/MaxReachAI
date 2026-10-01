"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label,
  successMessage,
  variant = "default",
  size = "sm",
  className,
  disabled,
}: {
  value: string;
  label: string;
  successMessage?: string;
  variant?: "primary" | "default" | "outline" | "ghost";
  size?: "sm" | "default" | "iconSm" | "icon";
  className?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const iconOnly = size === "iconSm" || size === "icon";

  async function copy() {
    if (!value) {
      toast.error("Nothing to copy yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage ?? `${label} copied`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Clipboard access was blocked by the browser");
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => void copy()}
      disabled={disabled}
      className={cn(className)}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
      {iconOnly ? null : copied ? "Copied" : label}
    </Button>
  );
}
