/**
 * POST /api/orgs/current/invitations/[id]/resend
 *
 * Regenerates the token (invalidating the old one) and extends the expiry by
 * 7 days. Only applicable to pending invitations (not consumed/revoked/deleted).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations API
 */

// Old Author: Puran
// New Author: Puran
// Impact: regenerates token + expiry AND sends a fresh invitation email
// Reason: "Resend" must actually mail the invitee with the new raw token

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import {
  generateInvitationToken,
  buildInvitationAcceptUrl,
} from "@/server/lib/team/invitationToken";
import { sendInvitationEmail } from "@/server/lib/email/sendInvitationEmail";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/orgs/current/invitations/[id]/resend";

/**
 * Rotates the invitation token + resets expiry to 7 days from now.
 * Returns 404 if the invitation isn't pending in the caller's org.
 *
 * @param req - The incoming request
 * @param params - Route params with invitation id
 * @returns Updated invitation (200) or error response
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

    // Verify invitation is pending AND in caller's org (§2.1)
    const existing = await db.invitation.findFirst({
      where: {
        id,
        orgId: permResult.orgId,
        consumedAt: null,
        revokedAt: null,
        deletedAt: null,
      },
      select: { id: true, email: true },
    });

    if (!existing) {
      return error("INVITATION_NOT_FOUND", "Invitation not found or no longer pending.", 404);
    }

    const { rawToken, tokenHash, expiresAt } = generateInvitationToken();

    // Update + fetch org name in parallel for the email body
    const [updated, org] = await Promise.all([
      db.invitation.update({
        where: { id },
        data: {
          tokenHash,
          expiresAt,
          sentAt: new Date(),
          updatedBy: permResult.userId,
        },
        include: { organizationRole: { select: { id: true, name: true } } },
      }),
      db.organization.findUnique({
        where: { id: permResult.orgId },
        select: { name: true },
      }),
    ]);

    logger.info("Invitation resent", {
      ...ctx,
      userId: permResult.userId,
      orgId: permResult.orgId,
      invitationId: id,
    });

    // Fire the email asynchronously — the HTTP response returns immediately.
    // The admin gets feedback in the UI toast; email delivery status is only
    // visible in server logs (same pattern as forgot-password).
    try {
      const acceptUrl = buildInvitationAcceptUrl(rawToken);
      sendInvitationEmail({
        toEmail: updated.email,
        orgName: org?.name ?? "your organization",
        roleName: updated.organizationRole.name,
        acceptUrl,
        recipientFirstName: updated.firstName,
        jobTitle: updated.jobTitle,
        inviterName: permResult.fullName,
        personalMessage: updated.personalMessage,
        expiresAt: updated.expiresAt,
      })
        .then(() => {
          logger.info("Invitation email resent", {
            ...ctx,
            invitationId: id,
            email: updated.email,
          });
        })
        .catch((emailErr) => {
          logger.error(
            "Invitation email resend failed",
            { ...ctx, invitationId: id, email: updated.email },
            emailErr
          );
        });
    } catch (urlErr) {
      logger.error(
        "Invitation email skipped on resend — no FRONTEND_URL",
        { ...ctx, invitationId: id },
        urlErr
      );
    }

    const { tokenHash: _tokenHash, ...sanitised } = updated;
    return success(sanitised);
  } catch (err) {
    logger.error("Failed to resend invitation", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
