"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, FileSpreadsheet, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/generator/field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fieldHint, fieldLabel, mappingIsComplete, suggestMapping } from "@/lib/bulk/columns";
import { parseCsv } from "@/lib/bulk/csv";
import type { ColumnMapping } from "@/lib/bulk/types";
import { CANONICAL_FIELDS } from "@/lib/bulk/types";
import type {
  Company,
  CompanyDetail,
  CompanyImportSummary,
} from "@/lib/crm/types";
import { cn } from "@/lib/utils";

type Step = "list" | "map";

interface ParsedFile {
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
}

export function CompaniesWorkspace({
  initialCompanies,
}: {
  initialCompanies: Company[];
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<Step>("list");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(() => suggestMapping([]));
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<CompanyImportSummary | null>(null);
  const [open, setOpen] = useState<CompanyDetail | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return companies;
    return companies.filter((company) => company.name.toLowerCase().includes(needle));
  }, [companies, query]);

  async function refreshList() {
    const response = await fetch("/api/companies");
    const payload = (await response.json()) as { companies?: Company[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Could not load companies.");
    setCompanies(payload.companies ?? []);
  }

  function applyFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const csv = parseCsv(String(reader.result ?? ""));
        setParsed({ filename: file.name, headers: csv.headers, rows: csv.rows });
        setMapping(suggestMapping(csv.headers));
        setSummary(null);
        setStep("map");
        toast.success(`${csv.rows.length} rows detected`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not read that CSV.");
      }
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (!parsed) return;
    if (!mappingIsComplete(mapping)) {
      toast.error("Map a name column before importing.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/companies/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: parsed.filename,
          mapping,
          rows: parsed.rows,
        }),
      });
      const payload = (await response.json()) as CompanyImportSummary & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Import failed.");
      setSummary(payload);
      await refreshList();
      setStep("list");
      toast.success("Import complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openCompany(id: string) {
    try {
      const response = await fetch(`/api/companies/${id}`);
      const payload = (await response.json()) as {
        company?: CompanyDetail;
        error?: string;
      };
      if (!response.ok || !payload.company) {
        throw new Error(payload.error ?? "Could not load that company.");
      }
      setOpen(payload.company);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load that company.");
    }
  }

  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <PageHeader
        title="Companies"
        description="Import a CSV with name, contact person, and email. Nothing is emailed from this page."
        actions={
          <Badge variant="outline">{companies.length} companies</Badge>
        }
      />

      {summary ? <ImportSummaryCard summary={summary} /> : null}

      {step === "map" && parsed ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {parsed.filename} · {parsed.rows.length} rows. Name is required.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep("list")} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void runImport()} disabled={busy}>
                {busy ? "Importing…" : "Import to Companies"}
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <p className="text-sm font-medium text-foreground">Match your columns</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Only name, contact person, and email are imported.
              </p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {CANONICAL_FIELDS.map((field) => (
                <Field
                  key={field}
                  label={fieldLabel(field)}
                  hint={field === "company" ? "Required" : "Optional"}
                >
                  <Select
                    value={mapping[field] || "__none__"}
                    onValueChange={(value) =>
                      setMapping((current) => ({
                        ...current,
                        [field]: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger aria-label={fieldLabel(field)}>
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not mapped</SelectItem>
                      {parsed.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[0.6875rem] leading-relaxed text-subtle-foreground">
                    {fieldHint(field)}
                  </p>
                </Field>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search companies"
                className="pl-9"
                aria-label="Search companies"
              />
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) applyFile(file);
                event.target.value = "";
              }}
            />
            <Button variant="primary" onClick={() => inputRef.current?.click()}>
              <Upload />
              Import CSV
            </Button>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) applyFile(file);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground",
              dragging ? "border-accent bg-accent-soft" : "border-border",
            )}
          >
            <FileSpreadsheet className="size-4 shrink-0" />
            Drop a CSV here, or click Import CSV. Then match the columns.
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[0.6875rem] tracking-wide text-subtle-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Contacts</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-16 text-center text-muted-foreground">
                      <Building2 className="mx-auto mb-3 size-6 text-subtle-foreground" />
                      No companies yet. Import a CSV to get started.
                    </td>
                  </tr>
                ) : (
                  visible.map((company) => (
                    <tr
                      key={company.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-hover"
                      onClick={() => void openCompany(company.id)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{company.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {company.contactCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-subtle-foreground">
                        {formatStamp(company.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.name}</DialogTitle>
            <DialogDescription>People imported for this company.</DialogDescription>
          </DialogHeader>
          {open ? (
            <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
              <div>
                <p className="eyebrow">Contacts ({open.contacts.length})</p>
                {open.contacts.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No contact person saved for this row yet.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {open.contacts.map((contact) => (
                      <li key={contact.id} className="px-3 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {[contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                            "Unnamed contact"}
                        </p>
                        <p className="text-xs text-muted-foreground">{contact.email || "No email"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportSummaryCard({ summary }: { summary: CompanyImportSummary }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <p className="text-sm font-medium text-foreground">Last import</p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-subtle-foreground">Imported</dt>
          <dd className="mt-1 text-foreground">
            {summary.importedCompanies} companies
            <br />
            {summary.importedContacts} contacts
          </dd>
        </div>
        <div>
          <dt className="text-subtle-foreground">Updated</dt>
          <dd className="mt-1 text-foreground">
            {summary.updatedCompanies} companies
            <br />
            {summary.updatedContacts} contacts
          </dd>
        </div>
        <div>
          <dt className="text-subtle-foreground">Skipped</dt>
          <dd className="mt-1 text-foreground">{summary.skippedRows} rows</dd>
        </div>
        <div>
          <dt className="text-subtle-foreground">Errors</dt>
          <dd className="mt-1 text-foreground">{summary.errors.length} rows</dd>
        </div>
      </dl>
      {summary.errors.length > 0 ? (
        <ul className="mt-3 text-xs text-danger">
          {summary.errors.slice(0, 8).map((item) => (
            <li key={`${item.row}-${item.company}`}>
              Row {item.row}
              {item.company ? ` (${item.company})` : ""}: {item.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}
