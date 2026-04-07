/**
 * PATCH  /api/orgs/current/roles/[id] — update an organization role
 * DELETE /api/orgs/current/roles/[id] — soft-delete a role (blocked if in use)
 *
 * Both endpoints verify the role belongs to the caller's org before any write
 * (§2.1 — never trust client-sent orgId, scope all queries).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Roles API
 */

// Author: Puran
// Impact: update and soft-delete endpoints for org roles
// Reason: roles management round-trip — create/read/update/delete

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { roleSchema } from "@/server/lib/validation/team";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { Prisma } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/roles/[id]";

/**
 * Updates an organization role. Only fields provided in the body are updated.
 * Role must belong to the caller's org — anything else returns 404.
 *
 * @param req - The incoming request with partial role fields in body
 * @param params - Route params (awaited per Next.js 16 async API)
 * @returns Updated role (200) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Roles API
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

    const permResult = requirePermission(orgResult, "role.manage");
    if (permResult instanceof Response) return permResult;

    const { id } = await params;
    const body = await req.json();
    const parsed = roleSchema.partial().safeParse(body);

    if (!parsed.success) {
      return error(
        "VALIDATION_ERROR",
        "Please check your input and try again.",
        400,
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    // Verify role exists in caller's org (§2.1 scoping) + pull isSystem
    // so we can reject edits to system roles before any writes
    const existing = await db.organizationRole.findFirst({
      where: { id, orgId: permResult.orgId, deletedAt: null },
      select: { id: true, isSystem: true },
    });

    if (!existing) {
      return error("ROLE_NOT_FOUND", "Role not found.", 404);
    }

    // System roles (currently only the founding "Admin") are locked against
    // rename / description / module-toggle / sortOrder changes. The lock is
    // per-row via isSystem — never rely on name === "Admin" since admins
    // can create their own roles called whatever they want.
    if (existing.isSystem) {
      return error(
        "SYSTEM_ROLE_LOCKED",
        "This is a system role and can't be edited.",
        403
      );
    }

    // Author: Puran
    // Impact: case-insensitive duplicate check on rename
    // Reason: Postgres unique index on (orgId, name) is case-sensitive, so a
    //         user could rename "Manager" → "manager" and end up with two
    //         visually-identical roles. Skip the check when name is omitted
    //         (other fields being patched) or unchanged.
    if (parsed.data.name) {
      const duplicate = await db.organizationRole.findFirst({
        where: {
          orgId: permResult.orgId,
          deletedAt: null,
          id: { not: id },
          name: { equals: parsed.data.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        return error("ROLE_NAME_EXISTS", "A role with this name already exists.", 409);
      }
    }

    try {
      const role = await db.organizationRole.update({
        where: { id },
        data: {
          ...parsed.data,
          updatedBy: permResult.userId,
        },
      });

      logger.info("Role updated", { ...ctx, userId: permResult.userId, orgId: permResult.orgId, roleId: id });
      return success(role);
    } catch (dbErr) {
      if (dbErr instanceof Prisma.PrismaClientKnownRequestError && dbErr.code === "P2002") {
        return error("ROLE_NAME_EXISTS", "A role with this name already exists.", 409);
      }
      throw dbErr;
    }
  } catch (err) {
    logger.error("Failed to update role", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Soft-deletes an organization role (§5.3).
 * Blocks the deletion if any active user or pending invitation references the role —
 * client must reassign first.
 *
 * @param req - The incoming request
 * @param params - Route params with role id
 * @returns Success (200) or 409 if role is in use
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Roles API
 */
export async function DELETE(
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

    const permResult = requirePermission(orgResult, "role.manage");
    if (permResult instanceof Response) return permResult;

    const { id } = await params;

    // Verify role is in caller's org + pull isSystem so we can reject
    // attempts to delete the founding Admin role before any counts run
    const existing = await db.organizationRole.findFirst({
      where: { id, orgId: permResult.orgId, deletedAt: null },
      select: { id: true, isSystem: true },
    });

    if (!existing) {
      return error("ROLE_NOT_FOUND", "Role not found.", 404);
    }

    // System roles (founding Admin) are locked against deletion. Deleting
    // the Admin role would orphan the founder and break the "at least one
    // system admin" invariant that members PATCH enforces.
    if (existing.isSystem) {
      return error(
        "SYSTEM_ROLE_LOCKED",
        "This is a system role and can't be deleted.",
        403
      );
    }

    // Block delete if any active user or pending invitation references this role.
    // Client must reassign first — prevents orphaned users with no role.
    const [userCount, inviteCount] = await Promise.all([
      db.user.count({
        where: { organizationRoleId: id, deletedAt: null },
      }),
      db.invitation.count({
        where: {
          organizationRoleId: id,
          consumedAt: null,
          revokedAt: null,
          deletedAt: null,
        },
      }),
    ]);

    if (userCount > 0 || inviteCount > 0) {
      return error(
        "ROLE_IN_USE",
        `This role is assigned to ${userCount} user(s) and ${inviteCount} pending invite(s). Please reassign them before deleting.`,
        409,
        { userCount, inviteCount }
      );
    }

    // Soft delete — set deletedAt (§5.3 never hard delete)
    await db.organizationRole.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: permResult.userId },
    });

    logger.info("Role deleted", { ...ctx, userId: permResult.userId, orgId: permResult.orgId, roleId: id });
    return success({ message: "Role deleted successfully." });
  } catch (err) {
    logger.error("Failed to delete role", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
