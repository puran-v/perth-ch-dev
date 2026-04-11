/**
 * GET    /api/orgs/current/categories — list product categories for caller's org
 * POST   /api/orgs/current/categories — create a new product category
 *
 * Both endpoints follow the standard guard chain
 * (requireAuth → requireOrg → requirePermission → requireModule)
 * and §2.1 — orgId is ALWAYS derived from the session, never the client.
 *
 * Categories are a sub-resource of the products domain so they reuse
 * the `product.read` / `product.manage` permissions and Module A gate
 * — fewer surfaces to maintain than introducing dedicated category
 * permissions for V1.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories)
 */

// Author: Puran
// Impact: per-org master list of product categories with case-
//         insensitive uniqueness and create-on-the-fly support
// Reason: replaces the free-text `category` string on products with
//         a real master list so filters / reporting / archiving
//         work correctly. Combobox in the form posts to this route.

import {
  requireAuth,
  requireOrg,
  requirePermission,
  requireModule,
} from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import {
  createCategorySchema,
  categoryNameToSlug,
} from "@/server/lib/validation/categories";
import { parsePagination, paginationMeta } from "@/server/lib/pagination";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { Prisma } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/categories";

/**
 * Returns a paginated list of active product categories for the
 * caller's organization. Soft-deleted rows are excluded so the picker
 * never offers them. Ordered by sortOrder asc, then name asc, so the
 * combobox shows them in a predictable order even before drag-to-
 * reorder ships.
 *
 * @param req - Incoming request with session_token cookie
 * @returns Paginated categories array (200) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories)
 */
export async function GET(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "product.read");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    const { page, limit, skip } = parsePagination(new URL(req.url).searchParams);

    // §2.1: orgId pinned to caller's org. §5.3: filter soft-deleted rows.
    const where = { orgId: permResult.orgId, deletedAt: null };

    const [categories, total] = await Promise.all([
      db.productCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.productCategory.count({ where }),
    ]);

    return Response.json({
      success: true,
      data: categories,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    logger.error("Failed to list categories", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Creates a new product category in the caller's organization.
 *
 * Slug is derived server-side from `name.toLowerCase().trim()` so the
 * `@@unique([orgId, slug])` constraint enforces case-insensitive
 * uniqueness regardless of what the client sends. The dedupe check
 * runs BEFORE the insert as well so a friendly 409 is returned
 * instead of leaking the raw Prisma P2002 error.
 *
 * Resurrection rule: if a soft-deleted category exists with the same
 * slug, the create call resurrects it (clears `deletedAt`, updates
 * `name` to the freshly-typed casing) instead of creating a duplicate.
 * Without this an admin who deleted "Inflatable" could never recreate
 * it because the unique index still blocks the slug.
 *
 * @param req - Incoming request with the create payload in JSON body
 * @returns Created (or resurrected) category (201) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories)
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "product.manage");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);

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

    const trimmedName = parsed.data.name.trim();
    const slug = categoryNameToSlug(trimmedName);

    // Author: Puran
    // Impact: pre-insert dedupe + soft-deleted resurrection
    // Reason: case-insensitive uniqueness is enforced via the slug
    //         column. If an active row already exists, return 409.
    //         If a soft-deleted row exists with the same slug, bring
    //         it back to life rather than creating a duplicate or
    //         leaking the constraint violation to the user.
    const existing = await db.productCategory.findUnique({
      where: {
        orgId_slug: {
          orgId: permResult.orgId,
          slug,
        },
      },
      select: { id: true, deletedAt: true },
    });

    if (existing && existing.deletedAt === null) {
      return error(
        "CATEGORY_NAME_EXISTS",
        "A category with this name already exists.",
        409
      );
    }

    if (existing && existing.deletedAt !== null) {
      const resurrected = await db.productCategory.update({
        where: { id: existing.id },
        data: {
          name: trimmedName,
          deletedAt: null,
          active: true,
          updatedBy: permResult.userId,
        },
      });
      logger.info("Category resurrected", {
        ...ctx,
        userId: permResult.userId,
        orgId: permResult.orgId,
        categoryId: resurrected.id,
      });
      return success(resurrected, 201);
    }

    try {
      const category = await db.productCategory.create({
        data: {
          orgId: permResult.orgId,
          name: trimmedName,
          slug,
          sortOrder: parsed.data.sortOrder ?? 0,
          createdBy: permResult.userId,
          updatedBy: permResult.userId,
        },
      });

      logger.info("Category created", {
        ...ctx,
        userId: permResult.userId,
        orgId: permResult.orgId,
        categoryId: category.id,
      });
      return success(category, 201);
    } catch (dbErr) {
      // Race-condition safety net: two concurrent creates with the same
      // slug would both pass the lookup above before either one wrote.
      // Map P2002 to the same friendly 409 instead of leaking Prisma.
      if (
        dbErr instanceof Prisma.PrismaClientKnownRequestError &&
        dbErr.code === "P2002"
      ) {
        return error(
          "CATEGORY_NAME_EXISTS",
          "A category with this name already exists.",
          409
        );
      }
      throw dbErr;
    }
  } catch (err) {
    logger.error("Failed to create category", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
