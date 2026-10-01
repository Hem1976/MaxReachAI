"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductsBrowser({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(products[0]?.id ?? "");

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? products.filter((product) =>
        [
          product.name,
          product.category,
          product.tagline,
          product.idealIndustries.join(" "),
          product.keywords.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : products;

  const active = visible.find((p) => p.id === activeId) ?? visible[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            className="pl-9"
            aria-label="Search products"
          />
        </div>

        <nav className="flex flex-col gap-1" aria-label="Products">
          {visible.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setActiveId(product.id)}
              aria-current={active?.id === product.id ? "true" : undefined}
              className={cn(
                "rounded-lg border px-4 py-3 text-left transition-colors duration-150 outline-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                active?.id === product.id
                  ? "border-[rgba(32,164,184,0.35)] bg-accent-soft text-accent"
                  : "border-transparent hover:border-border hover:bg-surface-raised",
              )}
            >
              <p className="text-sm font-medium text-foreground">{product.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {product.category}
              </p>
            </button>
          ))}
          {visible.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-xs text-muted-foreground">
              No product matches “{query}”.
            </p>
          ) : null}
        </nav>
      </div>

      {active ? (
        <article className="flex flex-col gap-8 rounded-xl border border-border bg-surface p-7">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{active.category}</Badge>
              <span className="font-mono text-[0.625rem] tracking-wide text-subtle-foreground uppercase">
                {active.id}
              </span>
            </div>
            <h2 className="display mt-4 text-2xl text-foreground">{active.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{active.tagline}</p>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-foreground">
              {active.description}
            </p>
          </header>

          <div className="grid gap-8 md:grid-cols-2">
            <ListBlock title="Ideal industries" items={active.idealIndustries} />
            <div>
              <p className="eyebrow">Ideal customer</p>
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {active.idealCustomer}
              </p>
            </div>
            <ListBlock title="Problems solved" items={active.problemsSolved} />
            <ListBlock title="Features" items={active.features} />
            <ListBlock title="Benefits" items={active.benefits} />
            <ListBlock title="Outreach angles" items={active.outreachAngles} />
          </div>

          <div className="rounded-lg border border-border bg-surface-raised p-5">
            <p className="eyebrow">Suggested ask</p>
            <p className="mt-2.5 text-sm text-foreground">{active.cta}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-6">
            <Button variant="primary" asChild>
              <Link href="/">
                Write outreach for this product
                <ArrowRight />
              </Link>
            </Button>
            <p className="text-xs text-subtle-foreground">
              Auto-detect keywords: {active.keywords.slice(0, 6).join(", ")}…
            </p>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2.5 text-[0.8125rem] leading-relaxed text-muted-foreground"
          >
            <span className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-border-strong" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
