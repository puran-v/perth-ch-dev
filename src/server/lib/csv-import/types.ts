/**
 * Shared types for the CSV import server lib.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: shared error/result shapes used by every import handler
// Reason: keeps the route handler agnostic to the per-kind importer
//         implementations — it just calls runImport(kind, file, ctx) and
//         renders whatever ImportResult comes back

/** Per-row validation / DB error stored on ImportJob.errors. */
export interface RowError {
  /**
   * 1-indexed row number as the user sees it in their spreadsheet
   * (header is row 1, first data row is row 2). Critical for error logs.
   */
  row: number;
  /** Optional column the error blames — empty for cross-cell errors. */
  field?: string;
  /** Machine-readable code (e.g. "INVALID_EMAIL", "DUPLICATE_KEY"). */
  code: string;
  /** Human-readable message shown to the operator. */
  message: string;
}

/** Outcome of a single import run, returned by every kind-specific importer. */
export interface ImportResult {
  /** Total data rows the parser saw (excluding the header row). */
  totalRows: number;
  /** Rows successfully written to the DB. */
  importedRows: number;
  /**
   * Rows skipped on purpose. Currently only the "ALREADY_EXISTS" case
   * (idempotent re-runs of the same row) lands here — these are NOT
   * errors, just no-ops.
   */
  skippedRows: number;
  /** Rows that hit a validation or DB error and were dropped. */
  failedRows: number;
  errors: RowError[];
}
