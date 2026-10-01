"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { BulkListDetail } from "@/components/bulk/bulk-list-detail";
import { Field } from "@/components/generator/field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fieldHint, fieldLabel, mappingIsComplete, suggestMapping } from "@/lib/bulk/columns";
import { parseCsv } from "@/lib/bulk/csv";
import {
  mergeCsvFiles,
  remapAfterMerge,
  type ParsedCsvFile,
} from "@/lib/bulk/merge";
import { SAMPLE_CSV } from "@/lib/bulk/sample";
import { CANONICAL_FIELDS, type ColumnMapping } from "@/lib/bulk/types";
import type { ContactList, ContactListImportSummary } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

type Step = "upload" | "map" | "done" | "view";

export function BulkWorkspace({ initialLists }: { initialLists: ContactList[] }) {
  const [lists, setLists] = useState(initialLists);
  const [step, setStep] = useState<Step>("upload");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [sources, setSources] = useState<ParsedCsvFile[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(() => suggestMapping([]));
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState<ContactListImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (sources.length === 0) return null;
    try {
      return mergeCsvFiles(sources);
    } catch {
      return null;
    }
  }, [sources]);

  const importableCount = parsed
    ? parsed.rows.filter((row) => (row[mapping.company] ?? "").trim()).length
    : 0;

  function addParsedSource(file: ParsedCsvFile) {
    setSources((current) => {
      const next = [...current, file];
      const merged = mergeCsvFiles(next);
      setMapping((currentMapping) => remapAfterMerge(merged.headers, currentMapping));
      return next;
    });
    setImportResult(null);
    setStep("map");
  }

  function applyFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const csv = parseCsv(text);
        addParsedSource({ filename: file.name, headers: csv.headers, rows: csv.rows });
        toast.success(`${file.name} added · ${csv.rows.length} rows`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not read that CSV.");
      }
    };
    reader.readAsText(file);
  }

  function applyFiles(fileList: FileList | File[]) {
    const files = [...fileList].filter(Boolean);
    if (files.length === 0) return;
    if (files.length === 1) {
      applyFile(files[0]);
      return;
    }
    const loaded: ParsedCsvFile[] = [];
    let index = 0;

    function readNext() {
      const file = files[index];
      if (!file) {
        if (loaded.length === 0) return;
        setSources((current) => {
          const next = [...current, ...loaded];
          const merged = mergeCsvFiles(next);
          setMapping((currentMapping) => remapAfterMerge(merged.headers, currentMapping));
          toast.success(
            `${loaded.length} files merged · ${merged.rows.length} rows total`,
          );
          return next;
        });
        setImportResult(null);
        setStep("map");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const csv = parseCsv(String(reader.result ?? ""));
          loaded.push({ filename: file.name, headers: csv.headers, rows: csv.rows });
          index += 1;
          readNext();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `Could not read ${file.name}.`);
        }
      };
      reader.readAsText(file);
    }

    readNext();
  }

  function removeSource(filename: string) {
    setSources((current) => {
      const next = current.filter((source) => source.filename !== filename);
      if (next.length === 0) {
        setStep("upload");
        setMapping(suggestMapping([]));
        return [];
      }
      const merged = mergeCsvFiles(next);
      setMapping((currentMapping) => remapAfterMerge(merged.headers, currentMapping));
      return next;
    });
  }

  function resetUpload() {
    setStep("upload");
    setSelectedListId(null);
    setSources([]);
    setMapping(suggestMapping([]));
    setImportResult(null);
  }

  function openList(listId: string) {
    setSelectedListId(listId);
    setStep("view");
  }

  function backToLists() {
    setStep("upload");
    setSelectedListId(null);
  }

  async function importList() {
    if (!parsed) return;
    if (!mappingIsComplete(mapping)) {
      toast.error("Map a company column before saving.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/lists/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: parsed.filename,
          mapping,
          rows: parsed.rows,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ContactListImportSummary & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not import the list.");
      setImportResult(payload);
      setLists((current) => {
        const next = current.filter((list) => list.id !== payload.list.id);
        return [payload.list, ...next].slice(0, 12);
      });
      setStep("done");
      toast.success(`Saved "${payload.list.name}" for campaigns`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import the list.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <PageHeader
        title="Bulk"
        description="Upload contact lists here. Use them on the Campaigns page when adding recipients."
        actions={
          step !== "upload" && step !== "view" ? (
            <Button variant="outline" onClick={resetUpload}>
              New list
            </Button>
          ) : null
        }
      />

      {step === "upload" ? (
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const files = event.dataTransfer.files;
              if (files.length > 1) applyFiles(files);
              else if (files[0]) applyFile(files[0]);
            }}
            className={cn(
              "relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed px-8 py-16 text-center transition-colors",
              dragging
                ? "border-accent bg-accent-soft"
                : "border-border-strong bg-surface",
            )}
          >
            <div className="grid-texture pointer-events-none absolute inset-0 opacity-40" />
            <span className="relative grid size-11 place-items-center rounded-[10px] border border-border-strong bg-surface-raised">
              <Upload className="size-5 text-subtle-foreground" />
            </span>
            <h2 className="display relative mt-6 text-lg text-foreground">
              Drop CSV files here
            </h2>
            <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Upload one list or merge several CSVs. Match columns on the next step, then use
              the list when building a campaign.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" onClick={() => inputRef.current?.click()}>
                Browse files
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "maxreach-sample-leads.csv";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download sample CSV
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = event.target.files;
                if (files && files.length > 1) applyFiles(files);
                else if (files?.[0]) applyFile(files[0]);
                event.target.value = "";
              }}
            />
          </div>

          {lists.length > 0 ? (
            <RecentLists
              lists={lists}
              activeListId={selectedListId}
              onOpen={openList}
            />
          ) : null}
        </section>
      ) : null}

      {step === "map" && parsed ? (
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          {sources.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {sources.length === 1 ? "Uploaded file" : "Merged files"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sources.length === 1
                      ? "Add another CSV to combine lists before saving."
                      : `${sources.length} CSVs combined into one list.`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mergeInputRef.current?.click()}
                >
                  <Plus />
                  Add CSV
                </Button>
                <input
                  ref={mergeInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    const files = event.target.files;
                    if (files && files.length > 0) applyFiles(files);
                    event.target.value = "";
                  }}
                />
              </div>
              <ul className="divide-y divide-border">
                {sources.map((source) => (
                  <li
                    key={source.filename}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <FileSpreadsheet className="size-4 shrink-0 text-subtle-foreground" />
                      <span className="truncate text-foreground">{source.filename}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {source.rows.length} rows
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label={`Remove ${source.filename}`}
                      onClick={() => removeSource(source.filename)}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Rows found</p>
              <p className="display mt-1 text-2xl text-foreground">{parsed.rows.length}</p>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {importableCount} {importableCount === 1 ? "row has" : "rows have"} a name and will
              be imported. Rows without a name are skipped.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <p className="text-sm font-medium text-foreground">Match your columns</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Match your CSV to name, contact person, and email. Name is required.
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
            <div className="border-t border-border px-5 py-4">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busy || importableCount === 0}
                onClick={() => void importList()}
              >
                {busy ? <LoaderCircle className="animate-spin" /> : <Users />}
                Save list ({importableCount} {importableCount === 1 ? "contact" : "contacts"})
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {step === "done" && importResult ? (
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <div className="rounded-xl border border-border bg-surface px-6 py-8 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <h2 className="display mt-4 text-xl text-foreground">List saved</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong className="text-foreground">{importResult.list.name}</strong> is ready for
              campaigns.
            </p>
            <dl className="mx-auto mt-6 grid max-w-sm gap-3 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Contacts in list</dt>
                <dd className="font-mono text-foreground">{importResult.list.contactCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">New contacts</dt>
                <dd className="font-mono text-foreground">{importResult.importedContacts}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Updated contacts</dt>
                <dd className="font-mono text-foreground">{importResult.updatedContacts}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Skipped rows</dt>
                <dd className="font-mono text-foreground">{importResult.skippedRows}</dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Button
                variant="primary"
                onClick={() => openList(importResult.list.id)}
              >
                View list
              </Button>
              <Button variant="outline" asChild>
                <a href="/campaigns">Go to campaigns</a>
              </Button>
              <Button variant="outline" onClick={resetUpload}>
                Upload another list
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {step === "view" && selectedListId ? (
        <BulkListDetail listId={selectedListId} onBack={backToLists} />
      ) : null}
    </div>
  );
}

function RecentLists({
  lists,
  activeListId,
  onOpen,
}: {
  lists: ContactList[];
  activeListId?: string | null;
  onOpen: (listId: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">Saved lists</p>
      <ul className="flex flex-col gap-2">
        {lists.map((list) => (
          <li key={list.id}>
            <button
              type="button"
              onClick={() => onOpen(list.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                list.id === activeListId
                  ? "border-border-strong bg-surface-hover"
                  : "border-border bg-surface hover:bg-surface-raised",
              )}
            >
              <span className="flex min-w-0 items-center gap-2 truncate">
                <FileSpreadsheet className="size-4 shrink-0 text-subtle-foreground" />
                <span className="truncate text-foreground">{list.name}</span>
                {list.filename ? (
                  <span className="truncate font-mono text-xs text-subtle-foreground">
                    {list.filename}
                  </span>
                ) : null}
              </span>
              <Badge variant="outline" className="shrink-0 font-mono">
                {list.contactCount} contacts
              </Badge>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Click a list to view and edit companies. Use saved lists on the Campaigns page when
        adding recipients.
      </p>
    </div>
  );
}
