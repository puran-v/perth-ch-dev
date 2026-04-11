/**
 * GET /api/auth/session-check
 *
 * Template route demonstrating the standard guard pattern for protected endpoints.
 * Uses requireAuth → requireOrg → requirePermission in sequence.
 *
 * Copy this pattern for any new org-scoped API route (§2.1, §6.3).
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - Guards Template
 */

// Author: Puran
// Impact: template protected route showing auth + org + permission guards
// Reason: establishes copy-paste pattern per §6.3 for all future protected routes

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/auth/session-check";

/**
 * Protected endpoint that validates session, org membership, and permissions.
 * Returns the authenticated context as proof of access.
 *
 * Guard chain: requireAuth → requireOrg → requirePermission
 * Any guard failure returns the appropriate error Response (401/403).
 *
 * @param req - The incoming request with session_token cookie
 * @returns Session context (200), 401 (not authenticated), or 403 (no org / no permission)
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - Guards Template
 */
export async function GET(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Step 1: Authenticate — returns AuthContext or 401
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    // Step 2: Require org — returns AuthContext (with orgId guaranteed) or 403
    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    // Step 3: Check permission — returns AuthContext or 403
    // Using "booking.read" so all roles (ADMIN/MANAGER/STAFF/DRIVER) can pass this template.
    // For org settings routes, use "org.settings.read" (ADMIN only).
    const permResult = requirePermission(orgResult, "booking.read");
    if (permResult instanceof Response) return permResult;

    // Step 4: Business logic — always scoped to orgId (§2.1)
    // const data = await db.someTable.findMany({ where: { orgId: permResult.orgId } });

    logger.info("Session check passed", { ...ctx, userId: permResult.userId, orgId: permResult.orgId });

    return success({
      authenticated: true,
      userId: permResult.userId,
      role: permResult.role,
      orgId: permResult.orgId,
    });
  } catch (err) {
    logger.error("Session check failed", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
