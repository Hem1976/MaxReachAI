"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      gap={10}
      toastOptions={{
        style: {
          background: "var(--surface-raised)",
          border: "1px solid var(--border-strong)",
          color: "var(--foreground)",
          borderRadius: "0.5rem",
          fontSize: "0.8125rem",
        },
      }}
    />
  );
}
