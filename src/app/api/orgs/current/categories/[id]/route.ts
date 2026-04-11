/**
 * PATCH  /api/orgs/current/categories/[id] — rename / reorder a category
 * DELETE /api/orgs/current/categories/[id] — soft-delete (blocked if in use)
 *
 * Both handlers verify the row belongs to the caller's org before any
 * read or write — §2.1, never trust client-sent IDs.
 *
 * The categories admin page does not exist yet (1a — create-on-the-fly
 * only for V1) but these endpoints already exist so the eventual
 * `/dashboard/products/categories` page can ship without backend work.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories)
 */

// Author: Puran
// Impact: rename + soft-delete endpoints for product categories
// Reason: full CRUD round-trip is the right architecture even though
//         only POST + GET ship in V1. Building the surface now means
//         the eventual admin page is a pure frontend job.

import {
  requireAuth,
  requireOrg,
  requirePermission,
  requireModule,
} from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import {
  updateCategorySchema,
  categoryNameToSlug,
} from "@/server/lib/validation/categories";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { Prisma } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/categories/[id]";

/**
 * Partially updates a product category. Only fields present in the
 * body are written. The row must belong to the caller's org —
 * anything else returns 404 (we don't leak cross-tenant existence).
 *
 * Renaming triggers a fresh case-insensitive dedupe against the new
 * slug, scoped to the same org and excluding the row being renamed.
 *
 * @param req - Incoming request with partial category fields in body
 * @param params - Route params with category id
 * @returns Updated category (200) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories)
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

    const permResult = requirePermission(orgResult, "product.manage");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    const { id } = await params;
    const body = await req.json();
    const parsed = updateCategorySchema.safeParse(body);

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

    // §2.1 — verify the row exists in the caller's org BEFORE any
    // further work. Without this lookup, an attacker could PATCH a
    // category id that belongs to another tenant.
    const existing = await db.productCategory.findFirst({
      where: { id, orgId: permResult.orgId, deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!existing) {
      return error("CATEGORY_NOT_FOUND", "Category not found.", 404);
    }

    // Author: Puran
    // Impact: case-insensitive duplicate check on rename
    // Reason: same rationale as the create handler — slug holds the
    //         lowercased name, so we have to recompute it from the
    //         new name and look up against (orgId, newSlug). Skip
    //         the check entirely when name is unchanged or omitted.
    let newSlug: string | undefined;
    if (parsed.data.name) {
      newSlug = categoryNameToSlug(parsed.data.name);
      if (newSlug !== existing.slug) {
        const duplicate = await db.productCategory.findFirst({
          where: {
            orgId: permResult.orgId,
            deletedAt: null,
            id: { not: id },
            slug: newSlug,
          },
          select: { id: true },
        });
        if (duplicate) {
          return error(
            "CATEGORY_NAME_EXISTS",
            "A category with this name already exists.",
            409
          );
        }
      }
    }

    try {
      const updated = await db.productCategory.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined
            ? { name: parsed.data.name.trim(), slug: newSlug }
            : {}),
          ...(parsed.data.sortOrder !== undefined
            ? { sortOrder: parsed.data.sortOrder }
            : {}),
          ...(parsed.data.active !== undefined
            ? { active: parsed.data.active }
            : {}),
          updatedBy: permResult.userId,
        },
      });

      // Author: Puran
      // Impact: dual-write — update the legacy products.category string
      //         column on every product currently referencing this id
      // Reason: dual-write rollout phase. The legacy column is still
      //         the source of truth for any consumer that hasn't been
      //         migrated to read via categoryRef yet. Keeping it in
      //         sync on rename means dropping the column later (in the
      //         follow-up PR) is a pure schema change with no data fix.
      if (parsed.data.name !== undefined) {
        await db.product.updateMany({
          where: {
            orgId: permResult.orgId,
            categoryId: id,
            deletedAt: null,
          },
          data: { category: parsed.data.name.trim() },
        });
      }

      logger.info("Category updated", {
        ...ctx,
        userId: permResult.userId,
        orgId: permResult.orgId,
        categoryId: id,
      });
      return success(updated);
    } catch (dbErr) {
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
    logger.error("Failed to update category", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Soft-deletes a product category (§5.3 — never hard delete).
 *
 * Blocks the deletion if any active product still references this
 * category and returns a friendly 409 `CATEGORY_IN_USE` so the
 * client can prompt the user to reassign first. Without an admin
 * UI yet (1a) the user has to open each product and pick a new
 * category — a future bulk reassign tool can call PATCH on the
 * affected products.
 *
 * @param req - Incoming request with session_token cookie
 * @param params - Route params with category id
 * @returns Success message (200) or 409 if in use
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories)
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

    const permResult = requirePermission(orgResult, "product.manage");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    const { id } = await params;

    const existing = await db.productCategory.findFirst({
      where: { id, orgId: permResult.orgId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return error("CATEGORY_NOT_FOUND", "Category not found.", 404);
    }

    // Author: Puran
    // Impact: block delete when any active product still references
    //         this category — admin must reassign first
    // Reason: aligns with the role-delete blocking behaviour and the
    //         FK's onDelete: Restrict guarantee. The 409 surfaces the
    //         exact count so the UI can show "12 products use this
    //         category — please reassign them first."
    const productCount = await db.product.count({
      where: {
        orgId: permResult.orgId,
        categoryId: id,
        deletedAt: null,
      },
    });

    if (productCount > 0) {
      return error(
        "CATEGORY_IN_USE",
        `This category is assigned to ${productCount} product(s). Please reassign them before deleting.`,
        409,
        { productCount }
      );
    }

    // Soft delete — set deletedAt (§5.3 never hard delete)
    await db.productCategory.update({
      where: { id },
      data: { deletedAt: new Date(), active: false, updatedBy: permResult.userId },
    });

    logger.info("Category deleted", {
      ...ctx,
      userId: permResult.userId,
      orgId: permResult.orgId,
      categoryId: id,
    });
    return success({ message: "Category deleted successfully." });
  } catch (err) {
    logger.error("Failed to delete category", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
