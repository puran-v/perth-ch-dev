/**
 * PATCH /api/orgs/current/members/[userId] — update a member's role
 *
 * V1 only allows changing the organizationRoleId. Email is stable;
 * users change it via profile settings in V2. The target user must
 * belong to the caller's org — anything else returns 404.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Members API
 */

// Author: Puran
// Impact: role change endpoint for the Users tab "Edit" action
// Reason: Team & Users Edit row needs to update which role a member has

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { updateMemberSchema } from "@/server/lib/validation/team";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/orgs/current/members/[userId]";

/**
 * Updates a member's organizationRoleId. Validates:
 *  - Target user is in caller's org (§2.1 scoping — not a tenant leak)
 *  - Role id belongs to caller's org
 *
 * @param req - The incoming request with { organizationRoleId }
 * @param params - Route params with userId
 * @returns Updated member (200) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Members API
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "team.update");
    if (permResult instanceof Response) return permResult;

    const { userId } = await params;
    const body = await req.json();
    const parsed = updateMemberSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        "VALIDATION_ERROR",
        "Please check your input and try again.",
        400,
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    // Verify the target user is in caller's org (§2.1). Pull the current
    // organizationRole so we can detect "moving off a system role" — the
    // last-system-admin invariant below depends on that check.
    const targetUser = await db.user.findFirst({
      where: { id: userId, orgId: permResult.orgId, deletedAt: null },
      select: {
        id: true,
        organizationRoleId: true,
        organizationRole: { select: { isSystem: true } },
      },
    });

    if (!targetUser) {
      return error("MEMBER_NOT_FOUND", "Member not found.", 404);
    }

    // Verify the new role is in the same org + pull isSystem so we can
    // decide whether the change keeps at least one system admin
    const role = await db.organizationRole.findFirst({
      where: {
        id: parsed.data.organizationRoleId,
        orgId: permResult.orgId,
        deletedAt: null,
      },
      select: { id: true, isSystem: true },
    });

    if (!role) {
      return error("INVALID_ROLE", "Role not found in your organization.", 400);
    }

    // Last-system-admin invariant:
    // If the target is currently on a system role AND the new role is NOT
    // a system role, the change is a demotion. Count how many OTHER active
    // users are still on any system role in this org — if the count is 0
    // after the change, refuse. This allows two-admins-to-one-admin flows
    // while preventing an org from ending up with zero admins.
    //
    // We count "any isSystem role" rather than "the exact same role" so
    // future system roles (Owner, Superadmin, etc.) still satisfy the
    // invariant as a group without needing per-row special-casing.
    const movingOffSystem =
      targetUser.organizationRole?.isSystem === true && role.isSystem === false;

    if (movingOffSystem) {
      const remainingSystemAdmins = await db.user.count({
        where: {
          orgId: permResult.orgId,
          id: { not: userId },
          deletedAt: null,
          organizationRole: {
            is: { isSystem: true, deletedAt: null },
          },
        },
      });

      if (remainingSystemAdmins === 0) {
        return error(
          "AT_LEAST_ONE_SYSTEM_ADMIN_REQUIRED",
          "You can't remove the only admin from your organization. Promote another user first.",
          409
        );
      }
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { organizationRoleId: role.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isVerified: true,
        // Mirror the shape the list endpoint returns so React Query's
        // cache update after mutation doesn't drop isSystem and cause
        // the Edit Member page to re-render with a narrower shape
        organizationRole: { select: { id: true, name: true, isSystem: true } },
      },
    });

    logger.info("Member role updated", {
      ...ctx,
      userId: permResult.userId,
      orgId: permResult.orgId,
      targetUserId: userId,
      newRoleId: role.id,
    });

    return success(updated);
  } catch (err) {
    logger.error("Failed to update member", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * DELETE /api/orgs/current/members/[userId]
 *
 * Soft-deletes a member from the caller's organization. Sets
 * `User.deletedAt` (per §5.3 — never hard delete) and ends every
 * active session for that user atomically so they're kicked out the
 * moment the request commits, instead of staying logged in until their
 * session cookie expires.
 *
 * Guards (in order):
 *   1. requireAuth + requireOrg + requirePermission("team.manage")
 *      — only ADMIN can revoke. MANAGER can edit member roles via the
 *      PATCH route but cannot remove members entirely.
 *   2. Cannot revoke yourself — returns CANNOT_REVOKE_SELF 400.
 *      Reason: revoking your own row mid-session locks you out of the
 *      next page load and creates a confusing UX. Forces the admin to
 *      use a dedicated profile-delete flow (when one exists in V2).
 *   3. Target user must be in caller's org (§2.1 scoping). Returns 404
 *      if not.
 *   4. Last-system-admin invariant: cannot revoke a member whose removal
 *      would leave the org with zero users on any system role. Returns
 *      AT_LEAST_ONE_SYSTEM_ADMIN_REQUIRED 409. Same rule as the PATCH
 *      route demote check, applied to the delete case.
 *
 * @param req - Incoming request
 * @param params - Route params with the target user id
 * @returns 200 { id, fullName } on success, or a stable error code
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Members API
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    // team.manage = ADMIN-only via the wildcard. MANAGER's permission
    // list does not include team.manage by design — managers can edit
    // roles but not remove members.
    const permResult = requirePermission(orgResult, "team.manage");
    if (permResult instanceof Response) return permResult;

    const { userId } = await params;

    // Block self-revoke. The acting user can never use this endpoint
    // to delete their own row — there will be a dedicated "leave org"
    // / profile-delete flow later if/when V2 needs it.
    if (userId === permResult.userId) {
      return error(
        "CANNOT_REVOKE_SELF",
        "You can't revoke your own access. Ask another admin to do it.",
        400
      );
    }

    // Verify the target user is in the caller's org and pull the
    // current organizationRole.isSystem so we can apply the last-admin
    // invariant before any writes.
    const targetUser = await db.user.findFirst({
      where: { id: userId, orgId: permResult.orgId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        organizationRole: { select: { isSystem: true } },
      },
    });

    if (!targetUser) {
      return error("MEMBER_NOT_FOUND", "Member not found.", 404);
    }

    // Last-system-admin invariant.
    // Mirrors the PATCH route's demote check, applied to delete: if the
    // target is currently on a system role, count how many OTHER active
    // users are still on any system role in this org. If zero, refuse.
    if (targetUser.organizationRole?.isSystem === true) {
      const remainingSystemAdmins = await db.user.count({
        where: {
          orgId: permResult.orgId,
          id: { not: userId },
          deletedAt: null,
          organizationRole: {
            is: { isSystem: true, deletedAt: null },
          },
        },
      });

      if (remainingSystemAdmins === 0) {
        return error(
          "AT_LEAST_ONE_SYSTEM_ADMIN_REQUIRED",
          "You can't revoke the only admin from your organization. Promote another user first.",
          409
        );
      }
    }

    // Soft-delete the user AND end every active session for that user
    // in a single transaction. The two writes must commit together so
    // we never leave a deleted user with live sessions or vice versa.
    // §5.3 — both writes use deletedAt instead of removing rows.
    // The User model doesn't carry an updatedBy column (only the
    // OrganizationRole / Invitation tables do). Audit trail comes from
    // the structured logger.info below — log includes both the actor
    // and the target. If we ever add updatedBy to User, set it here.
    const now = new Date();
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { deletedAt: now },
      }),
      db.session.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    logger.info("Member revoked (soft-deleted)", {
      ...ctx,
      userId: permResult.userId,
      orgId: permResult.orgId,
      targetUserId: userId,
    });

    return success({
      id: targetUser.id,
      fullName: targetUser.fullName,
      message: `${targetUser.fullName} has been removed from the organization.`,
    });
  } catch (err) {
    logger.error("Failed to revoke member", ctx, err);
    return error(
      "INTERNAL_ERROR",
      "Something went wrong while revoking the member. Please try again.",
      500
    );
  }
}
