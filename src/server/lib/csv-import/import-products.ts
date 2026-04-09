/**
 * Products importer — same shape as the customers one (parser → Zod →
 * batched insert) but the natural key is `(orgId, sku)` (when SKU is
 * present) and SKU is optional, so the de-dupe logic only kicks in for
 * rows that actually carry a SKU.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */

// Author: samir
// Impact: products-specific import logic
// Reason: see import-customers.ts header — one importer per kind keeps
//         the per-row validation + DB shape concerns local to each model

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import {
  PRODUCT_HEADERS,
  productRowSchema,
} from "@/server/lib/validation/csv-import";
import { parseCsv, splitCommaCell, type ParseFailure, type CsvRow } from "./parse";
import type { ImportResult, RowError } from "./types";

const INSERT_BATCH_SIZE = 500;

/**
 * Top-level entry. Returns either a parser failure or a per-row report.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import
 */
export async function importProducts(
  rawText: string,
  orgId: string,
  userId: string,
): Promise<ParseFailure | ImportResult> {
  const parsed = parseCsv(rawText, {
    requiredHeaders: PRODUCT_HEADERS.required,
    optionalHeaders: PRODUCT_HEADERS.optional,
  });
  if (!parsed.ok) return parsed;

  const errors: RowError[] = [];
  const validRows: ValidatedProduct[] = [];

  parsed.rows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2;
    const validated = validateProductRow(rawRow, rowNumber);
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

  // De-duplicate within the file by SKU. Rows without a SKU can never
  // collide because Postgres allows multiple NULLs in a unique index.
  const seenSkus = new Set<string>();
  const dedupedRows: ValidatedProduct[] = [];
  validRows.forEach((row) => {
    if (row.sku) {
      if (seenSkus.has(row.sku)) {
        errors.push({
          row: row.sourceRow,
          field: "sku",
          code: "DUPLICATE_IN_FILE",
          message: `SKU "${row.sku}" appears more than once in this file.`,
        });
        return;
      }
      seenSkus.add(row.sku);
    }
    dedupedRows.push(row);
  });

  // Look up existing SKUs so we can split insert vs skip. Rows without
  // SKU always insert fresh (no natural key to dedupe against).
  const existing =
    seenSkus.size > 0
      ? await db.product.findMany({
          where: {
            orgId,
            sku: { in: Array.from(seenSkus) },
            deletedAt: null,
          },
          select: { sku: true },
        })
      : [];
  const existingSkus = new Set(existing.map((p) => p.sku).filter((s): s is string => !!s));

  let importedCount = 0;
  let skippedCount = 0;
  const toInsert: ValidatedProduct[] = [];

  for (const row of dedupedRows) {
    if (row.sku && existingSkus.has(row.sku)) {
      skippedCount += 1;
      continue;
    }
    toInsert.push(row);
  }

  for (let start = 0; start < toInsert.length; start += INSERT_BATCH_SIZE) {
    const batch = toInsert.slice(start, start + INSERT_BATCH_SIZE);
    try {
      const result = await db.product.createMany({
        data: batch.map((row) => ({
          orgId,
          sku: row.sku,
          name: row.name,
          category: row.category,
          description: row.description,
          dailyRate: new Prisma.Decimal(row.daily_rate),
          weeklyRate:
            row.weekly_rate !== null ? new Prisma.Decimal(row.weekly_rate) : null,
          totalQuantity: row.total_quantity ?? 1,
          weightKg:
            row.weight_kg !== null ? new Prisma.Decimal(row.weight_kg) : null,
          lengthCm:
            row.length_cm !== null ? new Prisma.Decimal(row.length_cm) : null,
          widthCm: row.width_cm !== null ? new Prisma.Decimal(row.width_cm) : null,
          heightCm:
            row.height_cm !== null ? new Prisma.Decimal(row.height_cm) : null,
          setupMinutes: row.setup_minutes,
          packdownMinutes: row.packdown_minutes,
          powerRequired: row.power_required,
          ageGroupMin: row.age_group_min,
          ageGroupMax: row.age_group_max,
          maxOccupancy: row.max_occupancy,
          safetyNotes: row.safety_notes,
          tags: row.tags,
          createdBy: userId,
          updatedBy: userId,
        })),
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
    failedRows: errors.filter((e) => e.code !== "DUPLICATE_IN_FILE").length,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Per-row validation
// ---------------------------------------------------------------------------

interface ValidatedProduct {
  sourceRow: number;
  sku: string | null;
  name: string;
  category: string | null;
  description: string | null;
  daily_rate: string;
  weekly_rate: string | null;
  total_quantity: number | null;
  weight_kg: string | null;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  setup_minutes: number | null;
  packdown_minutes: number | null;
  power_required: boolean;
  age_group_min: number | null;
  age_group_max: number | null;
  max_occupancy: number | null;
  safety_notes: string | null;
  tags: string[];
}

type ValidationOutcome =
  | { ok: true; row: ValidatedProduct }
  | { ok: false; errors: RowError[] };

function validateProductRow(raw: CsvRow, rowNumber: number): ValidationOutcome {
  const candidate = {
    ...raw,
    tags: splitCommaCell(raw.tags ?? ""),
  };

  const result = productRowSchema.safeParse(candidate);
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

  // Author: samir
  // Impact: cross-cell rule — age_group_max must be ≥ age_group_min if both set
  // Reason: a product where max < min would be unbookable downstream
  const data = result.data;
  if (
    data.age_group_min !== null &&
    data.age_group_max !== null &&
    Number(data.age_group_max) < Number(data.age_group_min)
  ) {
    return {
      ok: false,
      errors: [
        {
          row: rowNumber,
          field: "age_group_max",
          code: "INVALID_RANGE",
          message: "age_group_max must be greater than or equal to age_group_min",
        },
      ],
    };
  }

  return {
    ok: true,
    row: {
      sourceRow: rowNumber,
      sku: data.sku ?? null,
      name: data.name,
      category: data.category ?? null,
      description: data.description ?? null,
      daily_rate: data.daily_rate,
      weekly_rate: data.weekly_rate ?? null,
      total_quantity: data.total_quantity !== null ? Number(data.total_quantity) : null,
      weight_kg: data.weight_kg ?? null,
      length_cm: data.length_cm ?? null,
      width_cm: data.width_cm ?? null,
      height_cm: data.height_cm ?? null,
      setup_minutes: data.setup_minutes !== null ? Number(data.setup_minutes) : null,
      packdown_minutes:
        data.packdown_minutes !== null ? Number(data.packdown_minutes) : null,
      power_required: Boolean(data.power_required),
      age_group_min: data.age_group_min !== null ? Number(data.age_group_min) : null,
      age_group_max: data.age_group_max !== null ? Number(data.age_group_max) : null,
      max_occupancy: data.max_occupancy !== null ? Number(data.max_occupancy) : null,
      safety_notes: data.safety_notes ?? null,
      tags: data.tags ?? [],
    },
  };
}
