/**
 * POST /api/orgs/current/invitations/[id]/revoke
 *
 * Marks an invitation as revoked (sets revokedAt). Revoked invitations can
 * no longer be consumed by the user — any attempt fails with INVALID_TOKEN.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations API
 */

// Author: Puran
// Impact: revoke action for the Pending tab — cancels a pending invitation
// Reason: admins need to cancel invites sent by mistake or to left employees

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/orgs/current/invitations/[id]/revoke";

/**
 * Revokes a pending invitation. Sets revokedAt to now — soft delete via
 * revokedAt rather than deletedAt so the audit trail stays visible.
 *
 * @param req - The incoming request
 * @param params - Route params with invitation id
 * @returns Success (200) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations API
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "team.invite");
    if (permResult instanceof Response) return permResult;

    const { id } = await params;

    const existing = await db.invitation.findFirst({
      where: {
        id,
        orgId: permResult.orgId,
        consumedAt: null,
        revokedAt: null,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return error("INVITATION_NOT_FOUND", "Invitation not found or no longer pending.", 404);
    }

    await db.invitation.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        updatedBy: permResult.userId,
      },
    });

    logger.info("Invitation revoked", { ...ctx, userId: permResult.userId, orgId: permResult.orgId, invitationId: id });
    return success({ message: "Invitation revoked." });
  } catch (err) {
    logger.error("Failed to revoke invitation", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
