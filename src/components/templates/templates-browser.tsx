"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Code, Eye, LayoutTemplate, Search } from "lucide-react";

import { EmailHtmlPreview } from "@/components/email-html-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { skinLabels } from "@/lib/templates/skins";
import type { EmailTemplate } from "@/lib/templates/types";

const STYLE_LABELS: Record<EmailTemplate["style"], string> = {
  "plain-text": "Plain text",
  minimal: "Minimal",
  branded: "Branded",
  editorial: "Editorial",
  bold: "Bold",
};

export function TemplatesBrowser({
  themeId,
  templates,
  templatesByCategory,
}: {
  themeId: string;
  templates: EmailTemplate[];
  templatesByCategory: Array<[string, EmailTemplate[]]>;
}) {
  const [active, setActive] = useState<EmailTemplate | null>(null);
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templatesByCategory
      .map(([category, group]) => {
        const filtered = needle
          ? group.filter((t) =>
              [t.name, t.purpose, t.bestFor, ...t.tags].join(" ").toLowerCase().includes(needle),
            )
          : group;
        return [category, filtered] as const;
      })
      .filter(([, group]) => group.length > 0);
  }, [query, templatesByCategory]);

  const visibleCount = grouped.reduce((sum, [, group]) => sum + group.length, 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative ml-auto w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates"
            className="h-8 pl-8 text-xs"
            aria-label="Search templates"
          />
        </div>
        <span className="font-mono text-[0.6875rem] text-subtle-foreground">
          {visibleCount} of {templates.length}
        </span>
      </div>

      <div className="flex flex-col gap-10">
        {grouped.map(([category, group]) => (
          <section key={category} className="flex flex-col gap-4">
            <div>
              <h2 className="display text-lg text-foreground">{category}</h2>
              <p className="mt-1 text-xs text-subtle-foreground">
                {category === "Introduction"
                  ? "First-touch emails that introduce Maxpro without a long pitch."
                  : "Emails that name one operational problem, then the product that removes it."}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {group.map((template) => (
                <article
                  key={template.id}
                  className="group flex flex-col rounded-xl border border-border bg-surface transition-colors duration-200 hover:border-border-strong"
                >
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant="outline">{template.category}</Badge>
                      <span className="font-mono text-[0.625rem] text-subtle-foreground">
                        {skinLabels[template.skin]}
                      </span>
                    </div>

                    <h3 className="display mt-4 text-base text-foreground">{template.name}</h3>
                    <p className="mt-2 flex-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                      {template.purpose}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                      <Badge variant="accent">{STYLE_LABELS[template.style]}</Badge>
                      {template.tags?.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded border border-border px-1.5 py-0.5 text-[0.625rem] text-subtle-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <p className="mt-3 text-xs text-subtle-foreground">Best for: {template.bestFor}</p>
                  </div>

                  <div className="flex items-center gap-2 border-t border-border px-5 py-3.5">
                    <Button variant="outline" size="sm" onClick={() => setActive(template)}>
                      <Eye />
                      Preview
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/?template=${template.id}`}>
                        Use template
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-4xl">
          {active ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{active.category}</Badge>
                  <Badge>{skinLabels[active.skin]}</Badge>
                </div>
                <DialogTitle className="mt-1">{active.name}</DialogTitle>
                <DialogDescription>{active.purpose}</DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <Tabs defaultValue="preview" className="flex flex-col gap-4">
                  <TabsList>
                    <TabsTrigger value="preview">
                      <Eye />
                      HTML preview
                    </TabsTrigger>
                    <TabsTrigger value="copy">
                      <LayoutTemplate />
                      Sample copy
                    </TabsTrigger>
                    <TabsTrigger value="structure">
                      <Code />
                      AI structure
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview">
                    <p className="mb-3 text-xs text-muted-foreground">
                      Palette and type belong to this layout. MaxReach fills the copy and the Maxpro
                      logo.
                    </p>
                    <EmailHtmlPreview
                      payload={{
                        templateId: active.id,
                        sample: true,
                        themeId,
                      }}
                      height={520}
                    />
                  </TabsContent>

                  <TabsContent value="copy">
                    <div className="rounded-lg border border-border bg-surface-raised">
                      <div className="border-b border-border px-5 py-3">
                        <p className="eyebrow">Subject</p>
                        <p className="mt-1.5 text-sm text-foreground">{active.sample.subject}</p>
                      </div>
                      <p className="px-5 py-5 text-sm leading-[1.75] whitespace-pre-wrap text-foreground">
                        {active.sample.body}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="structure">
                    <pre className="overflow-x-auto rounded-lg border border-border bg-surface-raised p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {active.structure}
                    </pre>
                  </TabsContent>
                </Tabs>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setActive(null)}>
                  Close
                </Button>
                <Button variant="primary" asChild>
                  <Link href={`/?template=${active.id}`}>
                    Use this template
                    <ArrowRight />
                  </Link>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
