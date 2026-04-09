/**
 * GET /api/orgs/current/import/status — drives the three step pills on
 * the CSV Import page (Done / Pending / Importing / Failed).
 *
 * Returns the most recent ImportJob per kind for the caller's org. The
 * FE maps each entry to a StepStatus via a one-line switch, no other
 * derivation needed.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import API
 */

// Author: samir
// Impact: replaces the FE's hardcoded mock literals (customers="done", etc)
// Reason: single round-trip → all 3 step pills + last-imported timestamps

import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { logger } from "@/server/lib/logger";
import { db } from "@/server/db/client";
import type { ImportKind } from "@/generated/prisma/enums";

const ROUTE = "/api/orgs/current/import/status";

const KINDS: ImportKind[] = ["CUSTOMERS", "PRODUCTS", "BOOKINGS"];

/**
 * Returns the most recent import job per kind for the authed org.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import API
 */
export async function GET(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "import.run");
    if (permResult instanceof Response) return permResult;

    const { orgId } = permResult;

    // Pull the most recent job per kind in parallel. Three queries are
    // cheaper than one with a window function and easier to read; the
    // (orgId, kind, createdAt desc) index makes each one a single seek.
    const [customers, products, bookings] = await Promise.all(
      KINDS.map((kind) =>
        db.importJob.findFirst({
          where: { orgId, kind },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            kind: true,
            status: true,
            filename: true,
            totalRows: true,
            importedRows: true,
            skippedRows: true,
            failedRows: true,
            failureReason: true,
            createdAt: true,
            completedAt: true,
          },
        }),
      ),
    );

    return success({
      customers: customers ? serializeJob(customers) : null,
      products: products ? serializeJob(products) : null,
      bookings: bookings ? serializeJob(bookings) : null,
    });
  } catch (err) {
    logger.error("Failed to fetch import status", ctx, err);
    return error(
      "INTERNAL_ERROR",
      "Something went wrong. Please try again.",
      500,
    );
  }
}

/**
 * The narrow shape returned by the `select` above. Defined inline so
 * the `serializeJob` parameter type matches what Prisma actually
 * returns (`select` strips fields like orgId, createdBy, errors).
 */
type JobLite = {
  id: string;
  kind: ImportKind;
  status: import("@/generated/prisma/enums").ImportStatus;
  filename: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  failureReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

/** Strip server-only fields + ISO-stringify dates. */
function serializeJob(job: JobLite) {
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
