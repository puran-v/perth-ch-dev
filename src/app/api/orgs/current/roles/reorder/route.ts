/**
 * PATCH /api/orgs/current/roles/reorder
 *
 * Bulk-updates sortOrder for multiple roles in a single transaction.
 * Verifies every role id belongs to the caller's org before writing (§2.1).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Roles API
 */

// Author: Puran
// Impact: bulk reorder endpoint for drag-and-drop role ordering in the UI
// Reason: frontend drag-and-drop needs a single atomic update across all roles

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { reorderRolesSchema } from "@/server/lib/validation/team";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/orgs/current/roles/reorder";

/**
 * Atomically updates sortOrder for multiple roles.
 * All role ids must belong to the caller's org — otherwise returns 403.
 *
 * @param req - The incoming request with { order: [{ id, sortOrder }] }
 * @returns Success (200) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Roles API
 */
export async function PATCH(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "role.manage");
    if (permResult instanceof Response) return permResult;

    const body = await req.json();
    const parsed = reorderRolesSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        "VALIDATION_ERROR",
        "Please check your input and try again.",
        400,
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const ids = parsed.data.order.map((r) => r.id);

    // Verify every role id belongs to caller's org — blocks tenant crossing (§2.1)
    const found = await db.organizationRole.findMany({
      where: { id: { in: ids }, orgId: permResult.orgId, deletedAt: null },
      select: { id: true },
    });

    if (found.length !== ids.length) {
      return error("FORBIDDEN", "One or more roles are not in your organization.", 403);
    }

    // Single transaction for atomic update — either all reorder or none
    await db.$transaction(
      parsed.data.order.map((r) =>
        db.organizationRole.update({
          where: { id: r.id },
          data: { sortOrder: r.sortOrder, updatedBy: permResult.userId },
        })
      )
    );

    logger.info("Roles reordered", { ...ctx, userId: permResult.userId, orgId: permResult.orgId, count: ids.length });
    return success({ message: "Roles reordered successfully.", count: ids.length });
  } catch (err) {
    logger.error("Failed to reorder roles", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
