/**
 * PATCH /api/orgs/current/invitations/[id]/remove-expiry
 *
 * Sets the invitation expiry to a far-future sentinel date (year 2099) so
 * it effectively never expires. Using a sentinel instead of nullable
 * expiresAt keeps index queries simple (`expiresAt > now()` still works).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations API
 */

// Author: Puran
// Impact: lets admins mark an invite as "never expires" (long-lived invites)
// Reason: product requested — some org setups take >7 days to complete

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { NO_EXPIRY_SENTINEL } from "@/server/lib/team/invitationToken";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/orgs/current/invitations/[id]/remove-expiry";

/**
 * Sets the invitation's expiresAt to the NO_EXPIRY_SENTINEL (far future).
 * Only applicable to pending invitations in the caller's org.
 *
 * @param req - The incoming request
 * @param params - Route params with invitation id
 * @returns Updated invitation (200) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations API
 */
export async function PATCH(
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

    const updated = await db.invitation.update({
      where: { id },
      data: { expiresAt: NO_EXPIRY_SENTINEL, updatedBy: permResult.userId },
      include: { organizationRole: { select: { id: true, name: true } } },
    });

    logger.info("Invitation expiry removed", { ...ctx, userId: permResult.userId, orgId: permResult.orgId, invitationId: id });

    const { tokenHash: _tokenHash, ...sanitised } = updated;
    return success(sanitised);
  } catch (err) {
    logger.error("Failed to remove invitation expiry", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
