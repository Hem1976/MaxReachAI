# MaxReach AI

**AI-powered sales outreach by Maxpro Infotech** — an internal tool for the
Maxpro sales team. It turns a lead brief, or a CSV of hundreds of leads, into
subject lines, a cold email, follow-ups and a CSV you can take into Smartlead.

Everything runs on the machine it is installed on. Generation happens through a
local [Ollama](https://ollama.com) model and history is kept in a local SQLite
file. No prospect data, product knowledge or generated copy leaves the machine,
and there is no external AI API.

## Requirements

- Node.js 20.9 or newer
- Ollama running locally with at least one model pulled

```bash
ollama pull llama3.2       # fast, works on modest hardware
ollama pull qwen2.5:7b     # noticeably better copy if the machine can take it
```

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

Open **Settings** first and set your name, role and the model to use. The
sidebar shows `CONNECTED` / `NOT CONNECTED` for Ollama at all times; if it is
not connected, the generator explains how to fix it instead of failing.

The first generation of a session is slow because the model has to load. The
**Warm up model** button in Settings does that ahead of time.

## Pages

| Page         | What it does                                                        |
| ------------ | ------------------------------------------------------------------- |
| `/`          | Single-lead generator: brief on the left, result on the right       |
| `/bulk`      | CSV import, column mapping, queued generation, review, CSV export   |
| `/templates` | Maxpro originals plus all 12 CodedMails themes (64 layouts)          |
| `/products`  | The Maxpro product knowledge the AI is allowed to use               |
| `/history`   | Every generation, searchable, with copy / delete / regenerate       |
| `/settings`  | Ollama endpoint, model, defaults and sender signature               |

## How the grounding works

The AI is never asked to recall anything about Maxpro. Instead:

1. **Product selection happens in code.** `detectProducts` scores the brief
   against the catalogue in `src/lib/products/data.ts`. The model only ever sees
   the one or two products that actually matched.
2. **The prompt states the product facts as a closed set** and forbids invented
   customers, statistics, pricing, integrations, certifications and case
   studies. See `src/lib/ai/prompts.ts`.
3. **Output is validated twice.** Zod checks the shape; `validateDraft` checks
   the semantics (real subject lines, a complete body, the right length) and
   triggers a targeted repair call when something is wrong.
4. **Whatever survives is reviewed, not trusted.** `reviewDraft` flags
   percentages, monetary figures, multiplier claims, unverifiable capability
   words and social proof in the UI so a human checks them before sending.
5. **Confidence is computed, not self-reported.** Asking a small model how
   confident it is just produces another invented number, so the score comes
   from how complete the brief was, how strongly the product matched and whether
   the output passed its own checks. See `src/lib/ai/confidence.ts`.

## Editing the knowledge base

`src/lib/products/data.ts` is the single source of truth for product facts.
Edit the strings and save — no build step, no migration. Anything not written
there will not appear in a generated email, and anything written there will be
treated as true and put in front of a prospect.

## Templates: copy vs design

Templates own **presentation**, the AI owns **copy**. The only bridge between
them is the `EmailContent` type. The model never emits markup, so it cannot
break a design.

- `src/lib/templates/definitions.ts` — the nineteen Maxpro templates. The
  `structure` field is the only part the model sees.
- `src/lib/templates/codedmails/` — all 12 CodedMails themes, 64 MJML layouts.
  The injector fills copy into the original design.
- `src/lib/templates/skins.ts` — the six plain and lightly-branded designs.
- `src/lib/templates/skins-rich.ts` — six block-driven designs adapted from
  vendored MIT sources.
- `src/lib/templates/blocks.ts` — splits one plain-text draft into the named
  slots a rich design needs.
- `src/lib/templates/render.ts` — MJML to responsive HTML, server-side only.

### How the richer designs get filled

A designed layout needs more than one blob of prose: a headline, a lede, a
capability list, a separated ask. Rather than asking the model for those
separately, `buildBlocks` derives them from output it has already produced plus
the local catalogue:

| Slot | Comes from |
| --- | --- |
| `headline` | The chosen subject line |
| `greeting`, `intro`, `paragraphs` | The draft body, split and stripped of its sign-off |
| `capabilities`, `outcomes` | `product.features` / `product.benefits`, verbatim |
| `cta`, `ctaLabel` | The draft's ask, removed from the body so it renders once |
| `signature`, `footerNote` | Settings |

Two consequences worth knowing. A richer template costs **no extra generation
time**, because there is no second model call. And the bulleted lists in a
designed email are **catalogue copy**, not model output, so they cannot contain
an invented capability.

### Themes

A **template** owns layout; a **theme** owns palette and type. They are
independent, so all nineteen templates render in any of the twelve themes in
`src/lib/templates/themes.ts` — 228 combinations from nineteen layouts.

| | |
| --- | --- |
| Neutral | Graphite (default), Paper, Ink, Slate |
| Cool | Oxford, Bottle, Teal, Indigo |
| Warm | Bordeaux, Oxide, Sandstone |
| Inverted | Carbon |

Email clients cannot read CSS variables, so a theme is inlined into the MJML at
render time rather than referenced. Skins take an `EmailTheme` and read every
colour off it — there are no hardcoded hex values in a skin, which is what
keeps a new theme from needing skin edits.

Two rules keep all twelve usable for B2B outreach: the accent is the only
saturated colour in a theme, and body text stays near 7:1 against its own
background. `Carbon` inverts the light skins, so skins call `isDarkTheme()`
rather than assuming a white card.

Set the team default in **Settings**. The Templates page and the generator's
HTML tab both have a per-preview picker that overrides it without saving, so
trying a theme never changes anyone else's default.

### Third-party template sources

The six block-driven layouts are adapted from MIT-licensed MJML sources
vendored under `vendor/email-templates/` (refresh with
`node scripts/vendor-templates.mjs`). Only structure was taken — palette, type
scale and all copy are Maxpro's. Per-template attribution lives on
`EmailTemplate.source` and is shown in the preview dialog.

`vendor/email-templates/NOTICE.md` records the licenses and what was taken
from where. CodedMails is included in full — all 12 themes and 64 MJML
layouts — refreshed with `node scripts/vendor-codedmails.mjs`. The site FAQ
allows commercial use; copyright is retained in
`vendor/email-templates/codedmails/LICENSE`.

### Checking templates

```bash
npm run check:templates   # renders every template, fails on MJML warnings
npm run check:themes      # renders Maxpro templates x 12 palettes
npm run e2e               # real generation against Ollama, then render
node scripts/preview-text.mjs cm-aleos-welcome
```

## Architecture notes

`generateOutreach({ brief, settings })` in `src/lib/ai/generate.ts` is a plain
async function with no request or UI dependencies. Bulk Outreach on `/bulk`
calls it through a SQLite-backed queue (default 2 leads at a time, never a
stampede of parallel Ollama requests):

```
CSV → map columns → normalize → match product → generateOutreach()
     → validate → save → next batch → export CSV → Smartlead
```

Rows without a company name are skipped. Empty cells stay empty — the model is
not allowed to invent headcount, tools, or other facts that were not in the
list. Successful rows are also written to History.

Swapping model runtime means changing `src/lib/ai/ollama.ts` and nothing else —
everything above it deals only in messages and JSON.

## Not in V1

No authentication, payments, CRM, analytics, vector database, RAG, email
sending, Smartlead or Apollo integration. Those are later phases.

## Data location

SQLite lives at `data/maxreach.db` (git-ignored). Override with the
`MAXREACH_DB_PATH` environment variable.
