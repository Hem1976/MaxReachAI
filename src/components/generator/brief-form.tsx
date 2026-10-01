"use client";

import { useMemo } from "react";
import { LoaderCircle, Sparkles, WandSparkles } from "lucide-react";

import { Field, FieldGroup } from "@/components/generator/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { lengths, objectives, tones } from "@/lib/constants";
import { getProduct } from "@/lib/products";
import { products } from "@/lib/products/data";
import { templatesGroupedForPicker } from "@/lib/templates";
import { recommendTemplate } from "@/lib/templates/recommend";
import type { LeadBrief } from "@/lib/types";

const SAMPLE_BRIEF: Partial<LeadBrief> = {
  company: "Northline Distribution",
  website: "northline.example",
  contactName: "Anita Rao",
  jobTitle: "Head of Sales Operations",
  industry: "FMCG distribution",
  notes:
    "Around 60 field reps across three states. Beat plans are made in Excel and shared over WhatsApp. Managers only see coverage numbers at month end and orders are phoned in to the back office.",
};

export function BriefForm({
  brief,
  onChange,
  onSubmit,
  busy,
  disabled,
}: {
  brief: LeadBrief;
  onChange: (next: Partial<LeadBrief>) => void;
  onSubmit: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const ready = brief.company.trim().length > 0;

  // Deterministic, so the rep can see why a template was suggested — and the
  // suggestion never overrides a choice they have already made.
  const suggestion = useMemo(
    () =>
      recommendTemplate(
        brief,
        brief.product === "auto" ? undefined : getProduct(brief.product),
      ),
    [brief],
  );

  const templatesByCategory = useMemo(() => templatesGroupedForPicker(), []);

  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={(event) => {
        // Cmd/Ctrl+Enter generates from anywhere in the form.
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          if (ready && !busy) onSubmit();
        }
      }}
    >
      <div className="flex flex-col gap-8 p-6">
        <div>
          <h1 className="display text-xl text-foreground">Write one email</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Fill this in. Generate is at the bottom.
          </p>
        </div>

        <FieldGroup title="Who is this for?">
          <Field label="Company name" htmlFor="company">
            <Input
              id="company"
              value={brief.company}
              onChange={(event) => onChange({ company: event.target.value })}
              placeholder="Northline Distribution"
              autoComplete="off"
              required
            />
          </Field>

          <Field label="Website" htmlFor="website" hint="Optional">
            <Input
              id="website"
              value={brief.website}
              onChange={(event) => onChange({ website: event.target.value })}
              placeholder="northline.example"
              autoComplete="off"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" htmlFor="contactName">
              <Input
                id="contactName"
                value={brief.contactName}
                onChange={(event) => onChange({ contactName: event.target.value })}
                placeholder="Anita Rao"
                autoComplete="off"
              />
            </Field>

            <Field label="Job title" htmlFor="jobTitle">
              <Input
                id="jobTitle"
                value={brief.jobTitle}
                onChange={(event) => onChange({ jobTitle: event.target.value })}
                placeholder="Head of Sales Operations"
                autoComplete="off"
              />
            </Field>
          </div>

          <Field label="Industry" htmlFor="industry" hint="Optional">
            <Input
              id="industry"
              value={brief.industry}
              onChange={(event) => onChange({ industry: event.target.value })}
              placeholder="FMCG distribution"
              autoComplete="off"
            />
          </Field>

          <Field
            label="Company information / notes"
            htmlFor="notes"
            hint="Optional, but helpful"
          >
            <Textarea
              id="notes"
              value={brief.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              placeholder="What do you know about how they operate today? Team size, current tools, the problem you think they have, anything from a call or their website."
              className="min-h-32"
            />
          </Field>
        </FieldGroup>

        <Separator />

        <FieldGroup title="The email">
          <Field label="Product">
            <Select
              value={brief.product}
              onValueChange={(value) =>
                onChange({ product: value as LeadBrief["product"] })
              }
            >
              <SelectTrigger aria-label="Maxpro product">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectGroup>
                  <SelectLabel>Products</SelectLabel>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Email objective">
            <Select
              value={brief.objective}
              onValueChange={(value) =>
                onChange({ objective: value as LeadBrief["objective"] })
              }
            >
              <SelectTrigger aria-label="Email objective">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {objectives.map((objective) => (
                  <SelectItem key={objective.value} value={objective.value}>
                    {objective.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tone">
              <Select
                value={brief.tone}
                onValueChange={(value) => onChange({ tone: value as LeadBrief["tone"] })}
              >
                <SelectTrigger aria-label="Tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tones.map((tone) => (
                    <SelectItem key={tone.value} value={tone.value}>
                      {tone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Email length">
              <Select
                value={brief.length}
                onValueChange={(value) =>
                  onChange({ length: value as LeadBrief["length"] })
                }
              >
                <SelectTrigger aria-label="Email length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lengths.map((length) => (
                    <SelectItem key={length.value} value={length.value}>
                      {length.label} · {length.words}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Look of the email" hint="Optional">
            <Select
              value={brief.templateId}
              onValueChange={(value) => onChange({ templateId: value })}
            >
              <SelectTrigger aria-label="Email template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templatesByCategory.map(([category, group]) => (
                  <SelectGroup key={category}>
                    <SelectLabel>{category}</SelectLabel>
                    {group.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {suggestion.template.id !== brief.templateId ? (
              <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-border bg-surface-raised px-3 py-2">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Suggested: {suggestion.template.name}
                  </span>
                  {suggestion.reasons.length > 0 ? (
                    <span className="block text-subtle-foreground">
                      {suggestion.reasons.slice(0, 2).join(" · ")}
                    </span>
                  ) : null}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onChange({ templateId: suggestion.template.id })}
                >
                  Use
                </Button>
              </div>
            ) : null}
          </Field>
        </FieldGroup>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-surface/95 p-6 backdrop-blur">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!ready || busy || disabled}
          className="w-full"
        >
          {busy ? (
            <>
              <LoaderCircle className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles />
              Generate email
            </>
          )}
        </Button>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(SAMPLE_BRIEF)}
            disabled={busy}
          >
            <WandSparkles />
            Fill example
          </Button>
          <span className="font-mono text-[0.625rem] tracking-wide text-subtle-foreground uppercase">
            Ctrl + Enter
          </span>
        </div>
      </div>
    </form>
  );
}
