import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint ? (
          <span className="text-[0.6875rem] text-subtle-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children}
    </section>
  );
}
