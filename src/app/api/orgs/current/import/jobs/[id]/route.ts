/**
 * GET /api/orgs/current/import/jobs/[id] — single ImportJob detail.
 *
 * Returns the full per-row error log so the FE can render a "view
 * errors" panel after an import. Scoped to the caller's org so a
 * tenant can never see another tenant's job.
 *
 * @author samir
 * @created 2026-04-09
 * @module Module A - CSV Import API
 */

import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { logger } from "@/server/lib/logger";
import { db } from "@/server/db/client";

const ROUTE = "/api/orgs/current/import/jobs/[id]";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const logCtx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "import.run");
    if (permResult instanceof Response) return permResult;

    const { id } = await ctx.params;
    if (!id) {
      return error("INVALID_ID", "Job id is required.", 400);
    }

    // §2.1 multi-tenant scope: orgId in WHERE, never trust the path
    const job = await db.importJob.findFirst({
      where: { id, orgId: permResult.orgId },
    });

    if (!job) {
      return error(
        "JOB_NOT_FOUND",
        "Import job not found in this organisation.",
        404,
      );
    }

    return success({
      id: job.id,
      kind: job.kind,
      status: job.status,
      filename: job.filename,
      totalRows: job.totalRows,
      importedRows: job.importedRows,
      skippedRows: job.skippedRows,
      failedRows: job.failedRows,
      failureReason: job.failureReason,
      // The errors column stores `[{ row, field?, code, message }]` and
      // is already capped at 500 entries by the upload route.
      errors: job.errors,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error("Failed to fetch import job", logCtx, err);
    return error(
      "INTERNAL_ERROR",
      "Something went wrong. Please try again.",
      500,
    );
  }
}
