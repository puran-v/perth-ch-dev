/**
 * POST /api/orgs/current/import/[kind] — runs a CSV import for the
 * authenticated org. Multipart upload, synchronous processing.
 *
 * Body: multipart/form-data with a single `file` field (the CSV).
 *
 * Steps:
 *   1. Auth → org → permission (`import.run`)
 *   2. Validate `kind` path param against the ImportKind enum
 *   3. Read the multipart file (rejected if missing, non-CSV, oversized)
 *   4. Call the kind-specific importer
 *   5. Persist an ImportJob row capturing what happened
 *   6. Return the same shape the FE useUploadCsv hook expects
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import API
 */

// Author: samir
// Impact: net-new POST endpoint replaces the FE's mock toast on file drop
// Reason: see csv_design.md — first half of the import flow is here

import { Prisma } from "@/generated/prisma/client";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { logger } from "@/server/lib/logger";
import { db } from "@/server/db/client";
import { importCustomers } from "@/server/lib/csv-import/import-customers";
import { importProducts } from "@/server/lib/csv-import/import-products";
import { importBookings } from "@/server/lib/csv-import/import-bookings";
import {
  MAX_IMPORT_FILE_BYTES,
} from "@/server/lib/validation/csv-import";
import type { ImportResult } from "@/server/lib/csv-import/types";
import type { ParseFailure } from "@/server/lib/csv-import/parse";
import type { ImportKind } from "@/generated/prisma/enums";

const ROUTE = "/api/orgs/current/import/[kind]";

/** Path-param string → Prisma enum, with explicit allow-list. */
const KIND_MAP: Record<string, ImportKind> = {
  customers: "CUSTOMERS",
  products: "PRODUCTS",
  bookings: "BOOKINGS",
};

/** Maps a Prisma ImportKind to the importer function for that kind. */
const IMPORTERS: Record<
  ImportKind,
  (raw: string, orgId: string, userId: string) => Promise<ImportResult | ParseFailure>
> = {
  CUSTOMERS: importCustomers,
  PRODUCTS: importProducts,
  BOOKINGS: importBookings,
};

/**
 * Type guard distinguishing a parser failure (no rows attempted) from
 * an ImportResult (rows processed, possibly with per-row errors).
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import API
 */
function isParseFailure(
  result: ImportResult | ParseFailure,
): result is ParseFailure {
  return "ok" in result && result.ok === false;
}

/**
 * Runs a CSV import for the authenticated org. Logs every outcome and
 * persists an ImportJob row regardless of success / failure so the
 * status endpoint can render the right pill on the FE.
 *
 * @param req - Multipart request with a `file` field
 * @param ctx - Next.js dynamic route context with `kind` param
 * @returns ImportJob row + the importer result on success
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import API
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ kind: string }> },
): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const logCtx = { route: ROUTE, requestId };

  try {
    // ── 1. Auth ───────────────────────────────────────────────────
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "import.run");
    if (permResult instanceof Response) return permResult;

    const { orgId, userId } = permResult;

    // ── 2. Resolve kind ───────────────────────────────────────────
    const { kind: kindParam } = await ctx.params;
    const kind = KIND_MAP[kindParam];
    if (!kind) {
      return error(
        "INVALID_KIND",
        `Unknown import kind "${kindParam}". Expected one of: customers, products, bookings.`,
        400,
      );
    }

    // ── 3. Read multipart file ────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return error(
        "INVALID_MULTIPART",
        "Request body must be multipart/form-data with a `file` field.",
        400,
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return error(
        "MISSING_FILE",
        "Upload a CSV file as the `file` form field.",
        400,
      );
    }

    // .csv by name OR by mime type — Safari sometimes leaves type empty
    // for files dragged from Finder, so name-suffix is the fallback.
    const isCsv =
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.name.toLowerCase().endsWith(".csv");
    if (!isCsv) {
      return error(
        "INVALID_FILE_TYPE",
        "Only .csv files are accepted.",
        400,
      );
    }

    // Size check pre-read so we don't pull a 100 MB file into memory just
    // to reject it. file.size is the byte length the browser reported.
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return error(
        "FILE_TOO_LARGE",
        `File is larger than the ${Math.floor(
          MAX_IMPORT_FILE_BYTES / (1024 * 1024),
        )} MB limit.`,
        413,
      );
    }

    const rawText = await file.text();

    // ── 4. Run importer ───────────────────────────────────────────
    const importer = IMPORTERS[kind];
    const outcome = await importer(rawText, orgId, userId);

    // ── 5. Persist ImportJob ──────────────────────────────────────
    if (isParseFailure(outcome)) {
      // Pre-validation rejection (wrong headers, oversized, malformed).
      // Persist a FAILED job so the FE status pill flips to "Failed"
      // and the user can see the error log.
      const job = await db.importJob.create({
        data: {
          orgId,
          kind,
          status: "FAILED",
          filename: file.name,
          totalRows: 0,
          importedRows: 0,
          skippedRows: 0,
          failedRows: 0,
          failureReason: `${outcome.code}: ${outcome.message}`,
          createdBy: userId,
          completedAt: new Date(),
        },
      });

      return success(
        {
          importJob: serializeJob(job),
          // Echo the failure code so the FE toast can branch on it
          failureCode: outcome.code,
        },
        // 422 = "we understood you, but the file content was unprocessable"
        422,
      );
    }

    // Per-row report — at least one row was attempted. Status is
    // COMPLETED unless every single row failed.
    const status =
      outcome.importedRows > 0 || outcome.skippedRows > 0
        ? "COMPLETED"
        : "FAILED";

    const job = await db.importJob.create({
      data: {
        orgId,
        kind,
        status,
        filename: file.name,
        totalRows: outcome.totalRows,
        importedRows: outcome.importedRows,
        skippedRows: outcome.skippedRows,
        failedRows: outcome.failedRows,
        // Cap stored errors at 500 — anything beyond that is rarely
        // actionable and risks bloating the JSON column. The user can
        // re-run the import after fixing the first batch. Cast to the
        // Prisma JSON input type so the structural-typing of `RowError`
        // is accepted (a typed object isn't structurally identical to
        // Prisma's `InputJsonObject` index signature).
        errors: outcome.errors.slice(0, 500) as unknown as Prisma.InputJsonValue,
        createdBy: userId,
        completedAt: new Date(),
      },
    });

    return success({
      importJob: serializeJob(job),
      // Flat shape — counts at the top level alongside importJob so the
      // FE doesn't have to dig two levels deep. Errors stay alongside.
      totalRows: outcome.totalRows,
      importedRows: outcome.importedRows,
      skippedRows: outcome.skippedRows,
      failedRows: outcome.failedRows,
      errors: outcome.errors,
    });
  } catch (err) {
    logger.error("CSV import failed unexpectedly", logCtx, err);
    return error(
      "INTERNAL_ERROR",
      "Something went wrong while processing the import. Please try again.",
      500,
    );
  }
}

// ---------------------------------------------------------------------------
// Wire-format helpers
// ---------------------------------------------------------------------------

/** Strip server-only fields and shape ImportJob for the FE. */
function serializeJob(
  job: Awaited<ReturnType<typeof db.importJob.create>>,
) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    filename: job.filename,
    totalRows: job.totalRows,
    importedRows: job.importedRows,
    skippedRows: job.skippedRows,
    failedRows: job.failedRows,
    failureReason: job.failureReason,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}
