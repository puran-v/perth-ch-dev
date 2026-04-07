/**
 * GET    /api/orgs/current/roles — list roles for the caller's org
 * POST   /api/orgs/current/roles — create a new role in the caller's org
 *
 * Both endpoints use the guard chain: requireAuth → requireOrg → requirePermission.
 * orgId is NEVER read from the client — always derived from the session (§2.1).
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Roles API
 */

// Author: Puran
// Impact: new org-scoped roles CRUD for Team & Users setup
// Reason: client-approved order — roles first, then invites reference them

import { requireAuth, requireOrg, requirePermission } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { roleSchema } from "@/server/lib/validation/team";
import { parsePagination, paginationMeta } from "@/server/lib/pagination";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { Prisma } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/roles";

/**
 * Returns a paginated list of roles for the caller's organization.
 * Ordered by sortOrder then name. Excludes soft-deleted roles.
 *
 * @param req - The incoming request with session_token cookie
 * @returns Paginated roles array (200) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Roles API
 */
export async function GET(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "role.read");
    if (permResult instanceof Response) return permResult;

    const { page, limit, skip } = parsePagination(new URL(req.url).searchParams);

    // Always scoped to orgId (§2.1) + filter out soft-deleted (§5.3)
    const where = { orgId: permResult.orgId, deletedAt: null };

    const [roles, total] = await Promise.all([
      db.organizationRole.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.organizationRole.count({ where }),
    ]);

    return Response.json({
      success: true,
      data: roles,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    logger.error("Failed to list roles", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Creates a new role in the caller's organization.
 * Only users with role.manage permission (ADMIN) can create roles.
 * Role name must be unique per org (enforced by DB constraint).
 *
 * @param req - The incoming request with role fields in body
 * @returns Created role (201) or error response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Roles API
 */
export async function POST(req: Request): Promise<Response> {
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
    const parsed = roleSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        "VALIDATION_ERROR",
        "Please check your input and try again.",
        400,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      );
    }

    try {
      const role = await db.organizationRole.create({
        data: {
          orgId: permResult.orgId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          sortOrder: parsed.data.sortOrder ?? 0,
          moduleA: parsed.data.moduleA ?? false,
          moduleB: parsed.data.moduleB ?? false,
          moduleC: parsed.data.moduleC ?? false,
          moduleD: parsed.data.moduleD ?? false,
          moduleE: parsed.data.moduleE ?? false,
          createdBy: permResult.userId,
          updatedBy: permResult.userId,
        },
      });

      logger.info("Role created", { ...ctx, userId: permResult.userId, orgId: permResult.orgId, roleId: role.id });
      return success(role, 201);
    } catch (dbErr) {
      // P2002 = unique constraint on (orgId, name)
      if (dbErr instanceof Prisma.PrismaClientKnownRequestError && dbErr.code === "P2002") {
        return error("ROLE_NAME_EXISTS", "A role with this name already exists.", 409);
      }
      throw dbErr;
    }
  } catch (err) {
    logger.error("Failed to create role", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
