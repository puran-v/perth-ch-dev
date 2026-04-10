/**
 * Bookings importer — header-only for V1 (no line items). Each row must
 * reference an existing customer in the same org by email; rows whose
 * email isn't found are reported as errors and skipped.
 *
 * Idempotency natural key: `(orgId, externalRef)`.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: bookings-specific import logic with FK resolution
// Reason: bookings reference customers — the importer needs a lookup pass
//         to resolve customer_email → customerId before insert. The
//         spec's "import customers first" gate is enforced visually on
//         the FE; the importer enforces it again here as a hard error
//         per row so a pre-customers booking import fails loudly.

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import {
  bookingRowSchema,
  BOOKING_HEADERS,
} from "@/server/lib/validation/csv-import";
import { parseCsv, type ParseFailure, type CsvRow } from "./parse";
import type { ImportResult, RowError } from "./types";

const INSERT_BATCH_SIZE = 500;

/**
 * Top-level entry. Returns either a parser failure or a per-row report.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
export async function importBookings(
  rawText: string,
  orgId: string,
  userId: string,
): Promise<ParseFailure | ImportResult> {
  const parsed = parseCsv(rawText, {
    requiredHeaders: BOOKING_HEADERS.required,
    optionalHeaders: BOOKING_HEADERS.optional,
  });
  if (!parsed.ok) return parsed;

  const errors: RowError[] = [];
  const validRows: ValidatedBooking[] = [];

  parsed.rows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2;
    const validated = validateBookingRow(rawRow, rowNumber);
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

  // De-duplicate within the file by external_ref
  const seenRefs = new Set<string>();
  const dedupedRows: ValidatedBooking[] = [];
  validRows.forEach((row) => {
    if (seenRefs.has(row.external_ref)) {
      errors.push({
        row: row.sourceRow,
        field: "external_ref",
        code: "DUPLICATE_IN_FILE",
        message: `external_ref "${row.external_ref}" appears more than once in this file.`,
      });
      return;
    }
    seenRefs.add(row.external_ref);
    dedupedRows.push(row);
  });

  // ── Customer FK resolution pass ───────────────────────────────────
  // Pull every distinct email mentioned in the file in one query, then
  // build an email → customerId map for O(1) lookups during insert.
  const distinctEmails = Array.from(
    new Set(dedupedRows.map((r) => r.customer_email)),
  );
  const customers = await db.customer.findMany({
    where: {
      orgId,
      email: { in: distinctEmails },
      deletedAt: null,
    },
    select: { id: true, email: true },
  });
  const customerByEmail = new Map(customers.map((c) => [c.email, c.id]));

  // Look up existing external_refs so we can split insert vs skip
  const existingRefs = await db.booking.findMany({
    where: {
      orgId,
      externalRef: { in: Array.from(seenRefs) },
      deletedAt: null,
    },
    select: { externalRef: true },
  });
  const existingRefSet = new Set(existingRefs.map((b) => b.externalRef));

  let importedCount = 0;
  let skippedCount = 0;
  const toInsert: Array<ValidatedBooking & { customerId: string }> = [];

  for (const row of dedupedRows) {
    if (existingRefSet.has(row.external_ref)) {
      // Idempotent re-run — silent skip
      skippedCount += 1;
      continue;
    }
    const customerId = customerByEmail.get(row.customer_email);
    if (!customerId) {
      errors.push({
        row: row.sourceRow,
        field: "customer_email",
        code: "CUSTOMER_NOT_FOUND",
        message: `No customer with email "${row.customer_email}" exists in this org. Import the customer first.`,
      });
      continue;
    }
    toInsert.push({ ...row, customerId });
  }

  // Batch insert. Booking is the only model in this PR with non-trivial
  // computed columns (balanceDue) — compute per-row inside the map.
  for (let start = 0; start < toInsert.length; start += INSERT_BATCH_SIZE) {
    const batch = toInsert.slice(start, start + INSERT_BATCH_SIZE);
    try {
      const result = await db.booking.createMany({
        data: batch.map((row) => {
          const subtotalDec = new Prisma.Decimal(row.subtotal);
          const depositDec =
            row.deposit_paid !== null
              ? new Prisma.Decimal(row.deposit_paid)
              : new Prisma.Decimal(0);
          const balanceDec = subtotalDec.sub(depositDec);
          return {
            orgId,
            externalRef: row.external_ref,
            customerId: row.customerId,
            // Postgres `Date` column — Prisma accepts a Date object
            eventDate: new Date(`${row.event_date}T00:00:00Z`),
            eventStartTime: row.event_start_time,
            eventEndTime: row.event_end_time,
            deliveryAddress: row.delivery_address,
            deliverySuburb: row.delivery_suburb,
            deliveryState: row.delivery_state,
            deliveryPostcode: row.delivery_postcode,
            contactPhone: row.contact_phone,
            specialInstructions: row.special_instructions,
            subtotal: subtotalDec,
            depositPaid: depositDec,
            balanceDue: balanceDec.lt(0) ? new Prisma.Decimal(0) : balanceDec,
            paymentStatus: row.payment_status,
            notes: row.notes,
            createdBy: userId,
            updatedBy: userId,
          };
        }),
        skipDuplicates: true,
      });
      importedCount += result.count;
      skippedCount += batch.length - result.count;
    } catch (err) {
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
    failedRows: errors.filter(
      (e) => e.code !== "DUPLICATE_IN_FILE" && e.code !== "CUSTOMER_NOT_FOUND",
    ).length +
      // CUSTOMER_NOT_FOUND counts as failed (not skipped) because the
      // user must take action — fix the email or import the customer.
      errors.filter((e) => e.code === "CUSTOMER_NOT_FOUND").length,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Per-row validation
// ---------------------------------------------------------------------------

interface ValidatedBooking {
  sourceRow: number;
  external_ref: string;
  customer_email: string;
  event_date: string;
  event_start_time: string | null;
  event_end_time: string | null;
  delivery_address: string;
  delivery_suburb: string | null;
  delivery_state: string | null;
  delivery_postcode: string | null;
  contact_phone: string | null;
  subtotal: string;
  deposit_paid: string | null;
  payment_status: "PAID" | "PARTIAL" | "UNPAID";
  special_instructions: string | null;
  notes: string | null;
}

type ValidationOutcome =
  | { ok: true; row: ValidatedBooking }
  | { ok: false; errors: RowError[] };

function validateBookingRow(raw: CsvRow, rowNumber: number): ValidationOutcome {
  const result = bookingRowSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => ({
        row: rowNumber,
        field: issue.path[0]?.toString(),
        code: "VALIDATION_ERROR",
        message: issue.message,
      })),
    };
  }

  const data = result.data;

  // Cross-cell rule: end time after start time (when both set)
  if (
    data.event_start_time &&
    data.event_end_time &&
    data.event_end_time <= data.event_start_time
  ) {
    return {
      ok: false,
      errors: [
        {
          row: rowNumber,
          field: "event_end_time",
          code: "INVALID_RANGE",
          message: "event_end_time must be after event_start_time",
        },
      ],
    };
  }

  // Normalise payment_status to enum case
  const status =
    data.payment_status === "paid"
      ? "PAID"
      : data.payment_status === "partial"
        ? "PARTIAL"
        : "UNPAID";

  return {
    ok: true,
    row: {
      sourceRow: rowNumber,
      external_ref: data.external_ref,
      customer_email: data.customer_email,
      event_date: data.event_date,
      event_start_time: data.event_start_time,
      event_end_time: data.event_end_time,
      delivery_address: data.delivery_address,
      delivery_suburb: data.delivery_suburb ?? null,
      delivery_state: data.delivery_state ?? null,
      delivery_postcode: data.delivery_postcode ?? null,
      contact_phone: data.contact_phone ?? null,
      subtotal: data.subtotal,
      deposit_paid: data.deposit_paid ?? null,
      payment_status: status,
      special_instructions: data.special_instructions ?? null,
      notes: data.notes ?? null,
    },
  };
}
