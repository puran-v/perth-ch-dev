/**
 * GET /api/orgs/current/members — paginated list of active users in the caller's org
 *
 * Returns public profile fields + the assigned organizationRole.
 * Never returns passwordHash or session tokens.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Members API
 */

// Old Author: Puran
// New Author: Puran
// Impact: include lastLoginAt from each user's most recent session so the
//         Users tab can show "Last Active" without an extra query per row
// Reason: client wants the Last Active column to surface real login times
//         instead of falling back to user.updatedAt as a stand-in

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { parsePagination, paginationMeta } from "@/server/lib/pagination";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/orgs/current/members";

/**
 * Returns a paginated list of active users in the caller's organization.
 * Ordered by fullName. Excludes soft-deleted users. Safe fields only.
 *
 * @param req - The incoming request with session_token cookie
 * @returns Paginated members (200) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Members API
 */
export async function GET(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "team.read");
    if (permResult instanceof Response) return permResult;

    const { page, limit, skip } = parsePagination(new URL(req.url).searchParams);

    const where = { orgId: permResult.orgId, deletedAt: null };

    const [rows, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
          // Include isSystem so the Edit Member page can show a "last admin"
          // warning when demoting a user currently on the system Admin role
          organizationRole: { select: { id: true, name: true, isSystem: true } },
          // Most recent session per user. Session.createdAt is the login
          // time. We don't filter by deletedAt because logged-out sessions
          // still count toward "last seen the user" — we want the most
          // recent login regardless of whether the session is still alive.
          // For V1 team sizes (≤ 50 users) this nested select is cheap;
          // if it becomes hot we can swap to a window function.
          sessions: {
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      db.user.count({ where }),
    ]);

    // Flatten the sessions array into a single lastLoginAt field so the
    // wire shape stays simple — clients shouldn't need to know about the
    // sessions relation.
    const members = rows.map(({ sessions, ...rest }) => ({
      ...rest,
      lastLoginAt: sessions[0]?.createdAt ?? null,
    }));

    return Response.json({
      success: true,
      data: members,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    logger.error("Failed to list members", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
