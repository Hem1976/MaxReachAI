"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Building2,
  History,
  LayoutTemplate,
  Megaphone,
  Settings,
  Sparkles,
  Table2,
} from "lucide-react";

import { Wordmark } from "@/components/logo";
import { OllamaStatusPanel } from "@/components/ollama-status";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: "/",
    label: "Generate",
    description: "Write one email",
    icon: Sparkles,
  },
  {
    href: "/bulk",
    label: "Bulk",
    description: "Upload lists for campaigns",
    icon: Table2,
  },
  {
    href: "/companies",
    label: "Companies",
    description: "Import your list",
    icon: Building2,
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    description: "Write, pick people, send",
    icon: Megaphone,
  },
  {
    href: "/templates",
    label: "Templates",
    description: "How emails look",
    icon: LayoutTemplate,
  },
  {
    href: "/products",
    label: "Products",
    description: "What you can offer",
    icon: Boxes,
  },
  {
    href: "/history",
    label: "History",
    description: "Saved emails",
    icon: History,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "AI and your name",
    icon: Settings,
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex shrink-0 flex-col gap-6 border-border bg-surface lg:h-dvh lg:w-[268px] lg:border-r lg:px-4 lg:py-5">
      <div className="flex items-center justify-between border-b border-border px-4 pt-4 pb-4 lg:border-0 lg:px-1 lg:pt-0 lg:pb-0">
        <Link
          href="/"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
        >
          <Wordmark />
        </Link>
      </div>

      <nav
        aria-label="Main"
        className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {navigation.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                active
                  ? "bg-accent-soft text-foreground"
                  : "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active ? "text-accent" : "text-subtle-foreground group-hover:text-muted-foreground",
                )}
              />
              <span className="flex flex-col leading-tight">
                <span className="font-medium">{item.label}</span>
                <span className="hidden text-[0.6875rem] text-subtle-foreground lg:block">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden lg:block">
        <OllamaStatusPanel />
        <p className="mt-3 px-1 text-[0.6875rem] leading-relaxed text-subtle-foreground">
          Runs on this computer
        </p>
      </div>
    </aside>
  );
}
