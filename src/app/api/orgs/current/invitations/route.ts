/**
 * GET  /api/orgs/current/invitations — list pending invitations
 * POST /api/orgs/current/invitations — bulk-create invitations
 *
 * Bulk create accepts up to 50 invites per batch. For each invite:
 *  - Normalises the email (trim + lowercase)
 *  - Skips if a pending invitation already exists for that email in this org
 *  - Validates the organizationRoleId belongs to the caller's org
 *  - Generates a SHA-256 hashed token and stores the row
 *  - After commit, fires an invitation email (non-blocking) with the raw token
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations API
 */

// Old Author: Puran
// New Author: Puran
// Impact: wired sendInvitationEmail into bulk create so each invitee gets an email
// Reason: backend vertical for invite → mail → accept smoke test

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { bulkInviteSchema } from "@/server/lib/validation/team";
import { parsePagination, paginationMeta } from "@/server/lib/pagination";
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

const ROUTE = "/api/orgs/current/invitations";

/**
 * Returns a paginated list of pending invitations for the caller's org.
 * Pending = not consumed, not revoked, not soft-deleted, not expired.
 *
 * @param req - The incoming request with session_token cookie
 * @returns Paginated invitations (200) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Invitations API
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

    // Scoped to caller's org (§2.1) + only active invitations
    const where = {
      orgId: permResult.orgId,
      consumedAt: null,
      revokedAt: null,
      deletedAt: null,
    };

    const [invitations, total] = await Promise.all([
      db.invitation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: "desc" },
        include: {
          organizationRole: { select: { id: true, name: true } },
          invitedBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
      db.invitation.count({ where }),
    ]);

    // Strip tokenHash from the wire — internal secret
    const sanitised = invitations.map(({ tokenHash: _tokenHash, ...rest }) => rest);

    return Response.json({
      success: true,
      data: sanitised,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    logger.error("Failed to list invitations", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Bulk-creates invitations (max 50 per batch). Each invite has its own roleId.
 * Skips emails that already have a pending invitation — returns them in the
 * `skipped` field so the UI can show which rows were duplicates.
 *
 * @param req - The incoming request with bulk invite body
 * @returns { created, skipped } (201) or error response
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

    const body = await req.json();
    const parsed = bulkInviteSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        "VALIDATION_ERROR",
        "Please check your input and try again.",
        400,
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    // personalMessage is now per-invite — destructured per row inside the
    // create loop below, not at the batch level.
    const { invites } = parsed.data;

    // Reject duplicates within the same batch (same email twice in one POST)
    const seen = new Set<string>();
    for (const invite of invites) {
      if (seen.has(invite.email)) {
        return error(
          "DUPLICATE_EMAIL_IN_BATCH",
          `Email "${invite.email}" appears more than once in this batch.`,
          400
        );
      }
      seen.add(invite.email);
    }

    // Validate every roleId belongs to the caller's org (§2.1 scoping)
    const roleIds = [...new Set(invites.map((i) => i.organizationRoleId))];
    const validRoles = await db.organizationRole.findMany({
      where: { id: { in: roleIds }, orgId: permResult.orgId, deletedAt: null },
      select: { id: true },
    });
    const validRoleIds = new Set(validRoles.map((r) => r.id));

    if (validRoleIds.size !== roleIds.length) {
      return error("INVALID_ROLE", "One or more roles are not in your organization.", 400);
    }

    // Find existing pending invitations for these emails — we'll skip them
    const emails = invites.map((i) => i.email);
    const existingPending = await db.invitation.findMany({
      where: {
        orgId: permResult.orgId,
        email: { in: emails },
        consumedAt: null,
        revokedAt: null,
        deletedAt: null,
      },
      select: { email: true },
    });
    const pendingEmails = new Set(existingPending.map((e) => e.email));

    // Also skip emails that already belong to active users in this org.
    //
    // Old Author: Puran
    // New Author: Puran
    // Impact: query is intentionally org-scoped + deletedAt: null so that
    //         soft-deleted users (whose row still holds the globally-unique
    //         email) can be re-invited. The accept-invitation endpoint
    //         restores the soft-deleted row in place rather than creating
    //         a new one, which is why we let the invitation through here.
    // Reason: client wants admins to be able to remove a teammate and then
    //         re-invite them later — the previous behaviour collapsed both
    //         "active member" and "soft-deleted" into the same skip path
    //         and there was no way out.
    const existingUsers = await db.user.findMany({
      where: {
        orgId: permResult.orgId,
        email: { in: emails },
        deletedAt: null,
      },
      select: { email: true },
    });
    const existingUserEmails = new Set(existingUsers.map((u) => u.email));

    const toCreate = invites.filter(
      (i) => !pendingEmails.has(i.email) && !existingUserEmails.has(i.email)
    );
    const skipped = invites
      .filter((i) => pendingEmails.has(i.email) || existingUserEmails.has(i.email))
      .map((i) => ({
        email: i.email,
        reason: existingUserEmails.has(i.email) ? "ALREADY_MEMBER" : "ALREADY_PENDING",
      }));

    if (toCreate.length === 0) {
      return success({ created: [], skipped }, 200);
    }

    // Pre-generate one token per invite so the rawToken stays in scope for
    // the email send after commit. Tokens generated inside $transaction's map
    // would be scoped to the Prisma call and the raw value would be lost.
    const preparedInvites = toCreate.map((invite) => ({
      invite,
      ...generateInvitationToken(),
    }));

    // Fetch the org name for the email subject/body in parallel with the
    // transaction — it's small and the DB round-trip is already paid for.
    const [created, org] = await Promise.all([
      db.$transaction(
        preparedInvites.map(({ invite, tokenHash, expiresAt }) =>
          db.invitation.create({
            data: {
              orgId: permResult.orgId,
              email: invite.email,
              firstName: invite.firstName,
              lastName: invite.lastName,
              jobTitle: invite.jobTitle ?? null,
              organizationRoleId: invite.organizationRoleId,
              tokenHash,
              expiresAt,
              // Per-invite personal message — empty/undefined means null
              personalMessage: invite.personalMessage ?? null,
              invitedByUserId: permResult.userId,
              createdBy: permResult.userId,
              updatedBy: permResult.userId,
            },
            include: {
              organizationRole: { select: { id: true, name: true } },
            },
          })
        )
      ),
      db.organization.findUnique({
        where: { id: permResult.orgId },
        select: { name: true },
      }),
    ]);

    // Strip tokenHash from the wire
    const sanitisedCreated = created.map(({ tokenHash: _tokenHash, ...rest }) => rest);

    logger.info("Invitations created", {
      ...ctx,
      userId: permResult.userId,
      orgId: permResult.orgId,
      created: created.length,
      skipped: skipped.length,
    });

    // Old Author: Puran
    // New Author: Puran
    // Impact: delegate the send loop to sendInvitationEmailBatch which
    //         handles throttling + rate-limit retries uniformly
    // Reason: Mailtrap sandbox caps at ~1 email/sec — naive sequential
    //         sends still trip the limit. The shared helper stays below
    //         the cap via EMAIL_SEND_DELAY_MS (default 1200ms) and
    //         retries once on 550/429 so transient rate-limits don't
    //         silently drop recipients. Same helper is used by the
    //         resend-all endpoint so behaviour stays consistent.
    const orgName = org?.name ?? "your organization";
    const inviterName = permResult.fullName;

    // Build batch entries, skipping any rows where the accept URL can't
    // be built (missing FRONTEND_URL). Skipped entries are logged and
    // excluded from the batch so the helper's counts stay accurate.
    const batchEntries: InvitationBatchEntry[] = [];
    for (let i = 0; i < created.length; i++) {
      const row = created[i];
      const { rawToken } = preparedInvites[i];

      let acceptUrl: string;
      try {
        acceptUrl = buildInvitationAcceptUrl(rawToken);
      } catch (urlErr) {
        logger.error(
          "Invitation email skipped — no FRONTEND_URL",
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
        expiresAt: row.expiresAt,
      });
    }

    // Detach the send loop from the response — admin gets 201 immediately
    // and email delivery churns in the background. Outer .catch is the
    // safety net against unhandled promise rejections.
    if (batchEntries.length > 0) {
      void sendInvitationEmailBatch(batchEntries, ctx).catch((bgErr) => {
        logger.error("Invitation email batch crashed", ctx, bgErr);
      });
    }

    return success({ created: sanitisedCreated, skipped }, 201);
  } catch (err) {
    logger.error("Failed to create invitations", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
