import { mergeParsedCsvs, type ParsedCsv } from "@/lib/bulk/csv";
import type { ColumnMapping } from "@/lib/bulk/types";
import { CANONICAL_FIELDS } from "@/lib/bulk/types";
import { suggestMapping } from "@/lib/bulk/columns";

export interface ParsedCsvFile {
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
}

export function mergeCsvFiles(sources: ParsedCsvFile[]): ParsedCsvFile {
  if (sources.length === 0) {
    throw new Error("Add at least one CSV before merging.");
  }

  const parsed: ParsedCsv[] = sources.map((source) => ({
    headers: source.headers,
    rows: source.rows,
    delimiter: ",",
  }));
  const merged = mergeParsedCsvs(parsed);

  const filename =
    sources.length === 1
      ? sources[0].filename
      : `${sources
          .map((source) => source.filename.replace(/\.csv$/i, ""))
          .join("+")}.csv`;

  return {
    filename,
    headers: merged.headers,
    rows: merged.rows,
  };
}

/** Keep column mapping where headers still exist after a merge. */
export function remapAfterMerge(headers: string[], current: ColumnMapping): ColumnMapping {
  const suggested = suggestMapping(headers);
  const next = { ...suggested };

  for (const field of CANONICAL_FIELDS) {
    const mapped = current[field];
    if (mapped && headers.includes(mapped)) {
      next[field] = mapped;
    }
  }

  return next;
}

export function leadMatchesProduct(
  lead: { productId: string; productName: string },
  productId: string,
  productName?: string,
): boolean {
  if (productId === "all") return true;
  if (productId === "__unassigned__") {
    return !lead.productId.trim() && !lead.productName.trim();
  }
  if (lead.productId === productId) return true;
  if (
    productName &&
    lead.productName.trim().toLowerCase() === productName.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}
