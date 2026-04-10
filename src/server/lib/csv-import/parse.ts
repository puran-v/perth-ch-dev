/**
 * Tiny RFC-4180-compatible CSV parser sized for the Module A import flow.
 *
 * Hand-rolled (no external dependency) because:
 *   1. The 10k-row cap means a streaming parser is overkill — we can hold
 *      the whole file in memory and parse synchronously.
 *   2. We need exact control over header validation (set equality vs the
 *      expected schema, friendly error codes for missing/unknown headers).
 *   3. Avoiding deps keeps the bundle size honest.
 *
 * Supports:
 *   - LF and CRLF line endings
 *   - UTF-8 BOM stripping
 *   - Quoted cells with embedded commas + escaped double quotes ("")
 *   - Trailing newline
 *   - Empty cells (rendered as "")
 *
 * Does NOT support (rejected with a clear error):
 *   - Embedded newlines inside quoted cells
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: net-new parser used by every import handler
// Reason: see header doc — single source of truth for "raw text → typed rows"

import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
} from "@/server/lib/validation/csv-import";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One row from the CSV, keyed by the canonical header name. */
export type CsvRow = Record<string, string>;

/** Successful parse result — header passed validation, rows are usable. */
export interface ParseSuccess {
  ok: true;
  headers: string[];
  rows: CsvRow[];
}

/** Failure result — short-circuits the entire import (no row even attempted). */
export interface ParseFailure {
  ok: false;
  code:
    | "EMPTY_FILE"
    | "FILE_TOO_LARGE"
    | "ROW_LIMIT_EXCEEDED"
    | "MISSING_REQUIRED_HEADERS"
    | "UNKNOWN_HEADERS"
    | "MALFORMED_CSV";
  message: string;
  /** Names of the headers the caller flagged when relevant. */
  headers?: string[];
}

export type ParseResult = ParseSuccess | ParseFailure;

interface ParseOptions {
  /** Headers that MUST be present. Order doesn't matter. */
  requiredHeaders: ReadonlyArray<string>;
  /** Headers that MAY be present. Anything outside required + optional fails. */
  optionalHeaders: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Parse entry
// ---------------------------------------------------------------------------

/**
 * Parses a raw CSV string into typed rows. Validates headers against the
 * caller's expected schema (set equality, no extra columns) and enforces
 * the global row + size caps before any per-row work begins.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
export function parseCsv(rawText: string, options: ParseOptions): ParseResult {
  // ── Pre-flight ────────────────────────────────────────────────────
  if (!rawText) {
    return {
      ok: false,
      code: "EMPTY_FILE",
      message: "The uploaded file is empty.",
    };
  }
  // Check raw byte length, not character count — non-ASCII content can
  // expand to ~3 bytes per char in UTF-8 and we want to bound the actual
  // payload size.
  const byteLength = Buffer.byteLength(rawText, "utf8");
  if (byteLength > MAX_IMPORT_FILE_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File is larger than the ${Math.floor(
        MAX_IMPORT_FILE_BYTES / (1024 * 1024),
      )} MB limit.`,
    };
  }

  // Strip UTF-8 BOM (Excel + Notepad love adding this) so the first
  // header doesn't end up as "\uFEFFfirst_name".
  const text = rawText.replace(/^\uFEFF/, "");

  // ── Tokenise ──────────────────────────────────────────────────────
  let parsed: string[][];
  try {
    parsed = tokenise(text);
  } catch (err) {
    return {
      ok: false,
      code: "MALFORMED_CSV",
      message:
        err instanceof Error
          ? err.message
          : "Could not parse the CSV file. Check for unbalanced quotes.",
    };
  }

  if (parsed.length === 0) {
    return {
      ok: false,
      code: "EMPTY_FILE",
      message: "The uploaded file is empty.",
    };
  }

  const headerRow = parsed[0]!.map((h) => h.trim());
  const dataRows = parsed.slice(1);

  // Drop trailing fully-empty rows that Excel sometimes appends
  while (dataRows.length > 0 && dataRows[dataRows.length - 1]!.every((c) => c.trim() === "")) {
    dataRows.pop();
  }

  if (dataRows.length === 0) {
    return {
      ok: false,
      code: "EMPTY_FILE",
      message: "The uploaded file has a header row but no data rows.",
    };
  }

  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      code: "ROW_LIMIT_EXCEEDED",
      message: `Maximum ${MAX_IMPORT_ROWS} rows per import. Got ${dataRows.length}.`,
    };
  }

  // ── Validate headers ──────────────────────────────────────────────
  const required = new Set(options.requiredHeaders);
  const optional = new Set(options.optionalHeaders);
  const seen = new Set(headerRow);

  const missing: string[] = [];
  for (const r of required) {
    if (!seen.has(r)) missing.push(r);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      code: "MISSING_REQUIRED_HEADERS",
      message: `Missing required header(s): ${missing.join(", ")}`,
      headers: missing,
    };
  }

  const unknown: string[] = [];
  for (const h of headerRow) {
    if (!required.has(h) && !optional.has(h)) {
      unknown.push(h);
    }
  }
  if (unknown.length > 0) {
    return {
      ok: false,
      code: "UNKNOWN_HEADERS",
      message: `Unknown header(s): ${unknown.join(
        ", ",
      )}. Remove or rename them to match the template.`,
      headers: unknown,
    };
  }

  // ── Map rows to objects keyed by header ───────────────────────────
  const rows: CsvRow[] = dataRows.map((cells) => {
    const obj: CsvRow = {};
    for (let i = 0; i < headerRow.length; i++) {
      const key = headerRow[i]!;
      // Defensive: short rows fall back to "" so the per-field Zod
      // schema can decide whether the missing value is a problem.
      obj[key] = (cells[i] ?? "").trim();
    }
    return obj;
  });

  return { ok: true, headers: headerRow, rows };
}

// ---------------------------------------------------------------------------
// Tokeniser — turns raw text into a 2D array of strings
// ---------------------------------------------------------------------------

/**
 * Splits a CSV string into rows + cells. Throws on malformed input
 * (unbalanced quote, embedded newline inside a quoted cell).
 *
 * Implementation note: a single character-by-character pass with a
 * minimal state machine is more readable than chained regex tricks and
 * avoids the catastrophic-backtracking gotchas regex CSV parsing is
 * famous for. Each pass through is O(n).
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function tokenise(text: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        // Lookahead for an escaped quote ("") inside a quoted cell
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        // Closing quote — leave quoted mode and consume the "
        inQuotes = false;
        i += 1;
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        throw new Error(
          "Embedded newlines inside quoted cells are not supported. Remove the line break and try again.",
        );
      }
      cell += ch;
      i += 1;
      continue;
    }

    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // Treat \r\n as a single newline; ignore lone \r the same way
      if (text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      cell = "";
      row = [];
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      cell = "";
      row = [];
      i += 1;
      continue;
    }

    cell += ch;
    i += 1;
  }

  // Trailing cell + row (file without a closing newline)
  if (inQuotes) {
    throw new Error("Unbalanced quote in CSV file.");
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Helpers exported for the per-kind importers
// ---------------------------------------------------------------------------

/**
 * Splits a comma-separated CSV cell into a trimmed array, dropping empty
 * entries. Used for the Tags column on customers and products.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
export function splitCommaCell(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
