/**
 * Small RFC 4180 CSV helper. Lives in-repo so we do not take on a parser
 * dependency for one import/export path.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
}

const MAX_CSV_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 2_000;

export const BULK_LIMITS = { maxBytes: MAX_CSV_BYTES, maxRows: MAX_ROWS };

export function parseCsv(text: string): ParsedCsv {
  if (text.length > MAX_CSV_BYTES) {
    throw new Error(
      `CSV is larger than ${Math.round(MAX_CSV_BYTES / (1024 * 1024))} MB. Split it into smaller files.`,
    );
  }

  const source = text.replace(/^\uFEFF/, "");
  if (!source.trim()) {
    throw new Error("The CSV is empty.");
  }

  const delimiter = detectDelimiter(source);
  const records = readRecords(source, delimiter);
  if (records.length === 0) {
    throw new Error("The CSV has no rows.");
  }

  const headers = uniquifyHeaders(records[0].map((header) => header.trim()));
  if (headers.every((header) => header === "")) {
    throw new Error("The CSV has no column headers.");
  }

  const rows: Record<string, string>[] = [];
  for (const record of records.slice(1)) {
    if (!record.some((cell) => cell.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (record[index] ?? "").trim();
    });
    rows.push(row);
    if (rows.length > MAX_ROWS) {
      throw new Error(
        `CSV has more than ${MAX_ROWS} data rows. Split the list and run it in batches.`,
      );
    }
  }

  if (rows.length === 0) {
    throw new Error("The CSV has headers but no prospect rows.");
  }

  return { headers, rows, delimiter };
}

/** Combine multiple parsed CSVs into one list with a unified header row. */
export function mergeParsedCsvs(sources: ParsedCsv[]): ParsedCsv {
  if (sources.length === 0) {
    throw new Error("Add at least one CSV before merging.");
  }
  if (sources.length === 1) {
    return sources[0];
  }

  const headers: string[] = [];
  for (const source of sources) {
    for (const header of source.headers) {
      if (!headers.includes(header)) headers.push(header);
    }
  }

  const rows = sources.flatMap((source) =>
    source.rows.map((row) => {
      const merged: Record<string, string> = {};
      for (const header of headers) {
        merged[header] = row[header] ?? "";
      }
      return merged;
    }),
  );

  if (rows.length > MAX_ROWS) {
    throw new Error(
      `Merged CSV has more than ${MAX_ROWS} data rows. Split the list and run it in batches.`,
    );
  }

  return { headers, rows, delimiter: sources[0].delimiter };
}

export function toCsv(headers: string[], rows: Array<Record<string, string>>): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvField(row[header] ?? "")).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function detectDelimiter(source: string): string {
  const first = firstPhysicalLine(source);
  const comma = countUnquoted(first, ",");
  const semi = countUnquoted(first, ";");
  const tab = countUnquoted(first, "\t");
  if (tab > comma && tab > semi) return "\t";
  if (semi > comma) return ";";
  return ",";
}

function firstPhysicalLine(source: string): string {
  let i = 0;
  let quoted = false;
  while (i < source.length) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        i += 2;
        continue;
      }
      quoted = !quoted;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      return source.slice(0, i);
    }
    i += 1;
  }
  return source;
}

function countUnquoted(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      count += 1;
    }
  }
  return count;
}

function readRecords(source: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = true;
      i += 1;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (char === "\r") {
      row.push(field);
      field = "";
      records.push(row);
      row = [];
      i += source[i + 1] === "\n" ? 2 : 1;
      continue;
    }

    if (char === "\n") {
      row.push(field);
      field = "";
      records.push(row);
      row = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (quoted) {
    throw new Error("The CSV has an unclosed quoted field.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  return records;
}

function uniquifyHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header || `column_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}
