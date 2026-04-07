/**
 * POST /api/orgs/current/invitations/resend-all
 *
 * Rotates the token + resets the expiry on every pending invitation in
 * the caller's org, then fires a fresh email for each one SEQUENTIALLY
 * in a detached background loop. Returns immediately with the count of
 * invitations that will be retried — delivery status is only visible in
 * server logs.
 *
 * "Pending" = not consumed, not revoked, not soft-deleted (expired rows
 * are included because resend bumps the expiry, so resending an expired
 * invite revives it).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations API
 */

// Author: Puran
// Impact: new bulk resend endpoint powering the "Resend All" button on
//         the Pending tab
// Reason: admins want one click to nudge every pending recipient instead
//         of firing Resend N times. Matches the Figma single bulk CTA.

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import {
  generateInvitationToken,
  buildInvitationAcceptUrl,
} from "@/server/lib/team/invitationToken";
import {
  sendInvitationEmailBatch,
  type InvitationBatchEntry,
} from "@/server/lib/email/sendInvitationEmail";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/orgs/current/invitations/resend-all";

/**
 * Resends every pending invitation in the caller's org.
 *
 * Flow:
 *   1. Auth + org + team.invite permission
 *   2. Fetch all pending invites + org name in parallel
 *   3. For each invite: generate a fresh token, update the row with the
 *      new tokenHash + expiresAt, collect the raw token for the email
 *   4. Detach a background sequential send loop; return 200 immediately
 *      with the count we queued
 *
 * @param req - Incoming request
 * @returns { count } (200) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations API
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "team.invite");
    if (permResult instanceof Response) return permResult;

    // Pull every pending invite for this org + the org name in parallel.
    // Pending = not consumed, not revoked, not soft-deleted. We include
    // invites whose expiresAt has already passed because resend bumps
    // the expiry — an expired row is still recoverable.
    const [pending, org] = await Promise.all([
      db.invitation.findMany({
        where: {
          orgId: permResult.orgId,
          consumedAt: null,
          revokedAt: null,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          jobTitle: true,
          personalMessage: true,
          organizationRole: { select: { id: true, name: true } },
        },
      }),
      db.organization.findUnique({
        where: { id: permResult.orgId },
        select: { name: true },
      }),
    ]);

    if (pending.length === 0) {
      return success({ count: 0, message: "No pending invitations to resend." });
    }

    // Rotate tokens + update expiry for every row in a single transaction
    // so we don't end up with a partial state. We collect the raw tokens
    // alongside the row data so the background loop can build the URLs.
    const prepared = pending.map((row) => ({
      row,
      ...generateInvitationToken(),
    }));

    await db.$transaction(
      prepared.map(({ row, tokenHash, expiresAt }) =>
        db.invitation.update({
          where: { id: row.id },
          data: {
            tokenHash,
            expiresAt,
            sentAt: new Date(),
            updatedBy: permResult.userId,
          },
        })
      )
    );

    logger.info("Bulk resend: tokens rotated", {
      ...ctx,
      userId: permResult.userId,
      orgId: permResult.orgId,
      count: prepared.length,
    });

    // Old Author: Puran
    // New Author: Puran
    // Impact: delegate the send loop to sendInvitationEmailBatch which
    //         handles throttling + rate-limit retries uniformly
    // Reason: Mailtrap sandbox rejects >1 email/sec with 550. The shared
    //         helper stays below the cap via EMAIL_SEND_DELAY_MS and
    //         retries once on 550/429. Same helper as bulk-create so
    //         delivery behaviour stays consistent across both batch paths.
    const orgName = org?.name ?? "your organization";
    const inviterName = permResult.fullName;

    // Build the batch, skipping any rows whose accept URL can't be built
    const batchEntries: InvitationBatchEntry[] = [];
    for (const { row, rawToken, expiresAt } of prepared) {
      let acceptUrl: string;
      try {
        acceptUrl = buildInvitationAcceptUrl(rawToken);
      } catch (urlErr) {
        logger.error(
          "Bulk resend: email skipped — no FRONTEND_URL",
          { ...ctx, invitationId: row.id },
          urlErr
        );
        continue;
      }

      batchEntries.push({
        invitationId: row.id,
        toEmail: row.email,
        orgName,
        roleName: row.organizationRole.name,
        acceptUrl,
        recipientFirstName: row.firstName,
        jobTitle: row.jobTitle,
        inviterName,
        personalMessage: row.personalMessage,
        // Use the freshly generated expiry from the prepared token, not
        // the stale row.expiresAt — the transaction already rotated it.
        expiresAt,
      });
    }

    if (batchEntries.length > 0) {
      void sendInvitationEmailBatch(batchEntries, ctx).catch((bgErr) => {
        logger.error("Bulk resend email batch crashed", ctx, bgErr);
      });
    }

    return success({
      count: prepared.length,
      message: `${prepared.length} invitation${prepared.length === 1 ? "" : "s"} being resent.`,
    });
  } catch (err) {
    logger.error("Bulk resend failed", ctx, err);
    return error(
      "INTERNAL_ERROR",
      "Something went wrong while resending invitations. Please try again.",
      500
    );
  }
}
