/**
 * Customers importer — validates each parsed row, batches inserts in
 * transactions of 500, and reports per-row errors.
 *
 * Idempotency: rows whose `(orgId, email)` already exists are SKIPPED
 * (not overwritten, not failed) — matches csv_design.md "duplicate emails
 * are detected and skipped — existing customer record is not overwritten".
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: customer-specific import logic — parser → Zod row schema → batched insert
// Reason: keeps the route handler thin; the route just orchestrates auth,
//         file read, importer call, and ImportJob persistence

import { db } from "@/server/db/client";
import {
  customerRowSchema,
  CUSTOMER_HEADERS,
} from "@/server/lib/validation/csv-import";
import { parseCsv, splitCommaCell, type ParseFailure, type CsvRow } from "./parse";
import type { ImportResult, RowError } from "./types";

/** Insert in chunks of 500 to keep transaction time + memory reasonable. */
const INSERT_BATCH_SIZE = 500;

/**
 * Top-level entry — returns either a parser failure (short-circuit, no
 * rows attempted) or an ImportResult summarising the per-row outcomes.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
export async function importCustomers(
  rawText: string,
  orgId: string,
  userId: string,
): Promise<ParseFailure | ImportResult> {
  const parsed = parseCsv(rawText, {
    requiredHeaders: CUSTOMER_HEADERS.required,
    optionalHeaders: CUSTOMER_HEADERS.optional,
  });
  if (!parsed.ok) return parsed;

  const errors: RowError[] = [];
  const validRows: ValidatedCustomer[] = [];

  // Per-row validation pass — collect errors row-by-row, don't bail
  // on the first failure. The user wants ALL the bad rows in one report
  // so they can fix the file in one editing pass instead of N attempts.
  parsed.rows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2; // +1 for 0-index, +1 for the header row
    const validated = validateCustomerRow(rawRow, rowNumber);
    if (validated.ok) {
      validRows.push(validated.row);
    } else {
      errors.push(...validated.errors);
    }
  });

  if (validRows.length === 0) {
    return {
      totalRows: parsed.rows.length,
      importedRows: 0,
      skippedRows: 0,
      failedRows: errors.length,
      errors,
    };
  }

  // De-duplicate within the file: if two rows have the same email, keep
  // the first and report the rest as skipped (matches the "first row wins"
  // pattern operators expect from spreadsheet de-dupe tools).
  const seenEmails = new Set<string>();
  const dedupedRows: ValidatedCustomer[] = [];
  validRows.forEach((row) => {
    if (seenEmails.has(row.email)) {
      errors.push({
        row: row.sourceRow,
        field: "email",
        code: "DUPLICATE_IN_FILE",
        message: `Email "${row.email}" appears more than once in this file.`,
      });
      return;
    }
    seenEmails.add(row.email);
    dedupedRows.push(row);
  });

  // Look up existing customers by email so we can split inserts vs skips.
  // One round-trip beats N — even at the 10k cap this is a single SELECT.
  const existing = await db.customer.findMany({
    where: {
      orgId,
      email: { in: Array.from(seenEmails) },
      deletedAt: null,
    },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((c) => c.email));

  let importedCount = 0;
  let skippedCount = 0;
  const toInsert: ValidatedCustomer[] = [];

  for (const row of dedupedRows) {
    if (existingEmails.has(row.email)) {
      skippedCount += 1;
      continue;
    }
    toInsert.push(row);
  }

  // Batch insert in chunks. We deliberately do NOT wrap the whole import
  // in a single transaction — a 10k-row insert in one tx holds locks for
  // a long time and any failure rolls back the whole thing. Per-batch
  // transactions give us partial-progress on failure plus tighter locks.
  for (let start = 0; start < toInsert.length; start += INSERT_BATCH_SIZE) {
    const batch = toInsert.slice(start, start + INSERT_BATCH_SIZE);
    try {
      const result = await db.customer.createMany({
        data: batch.map((row) => ({
          orgId,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone,
          mobile: row.mobile,
          company: row.company,
          addressLine1: row.address_line1,
          addressSuburb: row.address_suburb,
          addressState: row.address_state,
          addressPostcode: row.address_postcode,
          notes: row.notes,
          tags: row.tags,
          createdBy: userId,
          updatedBy: userId,
        })),
        // Belt-and-braces against a race where a row was inserted between
        // our findMany and our createMany — Prisma's skipDuplicates uses
        // ON CONFLICT DO NOTHING under the hood for the @@unique constraint.
        skipDuplicates: true,
      });
      importedCount += result.count;
      // Anything Prisma silently skipped (race-condition collisions) gets
      // counted as skipped, not failed.
      skippedCount += batch.length - result.count;
    } catch (err) {
      // Whole-batch failure — flag every row in the batch as failed
      // with the same code so the operator sees which rows didn't land.
      const message =
        err instanceof Error ? err.message : "Database error during insert";
      batch.forEach((row) => {
        errors.push({
          row: row.sourceRow,
          code: "DB_INSERT_FAILED",
          message,
        });
      });
    }
  }

  return {
    totalRows: parsed.rows.length,
    importedRows: importedCount,
    skippedRows: skippedCount,
    failedRows: errors.filter((e) => e.code !== "DUPLICATE_IN_FILE").length,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Per-row validation
// ---------------------------------------------------------------------------

/** Validated row + the spreadsheet row number it came from. */
interface ValidatedCustomer {
  sourceRow: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  company: string | null;
  address_line1: string | null;
  address_suburb: string | null;
  address_state: string | null;
  address_postcode: string | null;
  notes: string | null;
  tags: string[];
}

type ValidationOutcome =
  | { ok: true; row: ValidatedCustomer }
  | { ok: false; errors: RowError[] };

/**
 * Validates one CSV row against `customerRowSchema`. The CSV cell for
 * Tags is comma-separated; we split it before passing through Zod.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function validateCustomerRow(raw: CsvRow, rowNumber: number): ValidationOutcome {
  // Split tags from CSV string into an array before Zod sees it
  const candidate = {
    ...raw,
    tags: splitCommaCell(raw.tags ?? ""),
  };

  const result = customerRowSchema.safeParse(candidate);
  if (!result.success) {
    const errors: RowError[] = result.error.issues.map((issue) => ({
      row: rowNumber,
      field: issue.path[0]?.toString(),
      code: zodIssueToCode(issue.code),
      message: issue.message,
    }));
    return { ok: false, errors };
  }

  // Coerce Zod undefined → null so the inserter writes NULL columns
  return {
    ok: true,
    row: {
      sourceRow: rowNumber,
      first_name: result.data.first_name,
      last_name: result.data.last_name,
      email: result.data.email,
      phone: result.data.phone ?? null,
      mobile: result.data.mobile ?? null,
      company: result.data.company ?? null,
      address_line1: result.data.address_line1 ?? null,
      address_suburb: result.data.address_suburb ?? null,
      address_state: result.data.address_state ?? null,
      address_postcode: result.data.address_postcode ?? null,
      notes: result.data.notes ?? null,
      tags: result.data.tags ?? [],
    },
  };
}

/**
 * Maps a Zod issue code to a stable machine-readable error code so the
 * FE can render specific copy / icons for known cases without parsing
 * messages.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
function zodIssueToCode(zodCode: string): string {
  switch (zodCode) {
    case "invalid_type":
      return "INVALID_TYPE";
    case "too_small":
      return "VALUE_TOO_SHORT";
    case "too_big":
      return "VALUE_TOO_LONG";
    case "custom":
      return "INVALID_VALUE";
    default:
      return "VALIDATION_ERROR";
  }
}
