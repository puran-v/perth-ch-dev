/**
 * Single bundle API — get, update, soft-delete.
 *
 * GET    /api/orgs/current/bundles/[id]  → fetch one bundle with items
 * PATCH  /api/orgs/current/bundles/[id]  → update bundle fields + items
 * DELETE /api/orgs/current/bundles/[id]  → soft-delete the bundle
 *
 * Follows the guard chain: Auth → Org → Permission → Module A (§6.3).
 * orgId is always derived from session, never from client (§2.1).
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (API)
 */

// Author: samir
// Impact: detail/update/delete endpoints for individual bundles
// Reason: completes the CRUD surface for the bundles feature

import { requireAuth, requireOrg, requirePermission, requireModule } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { db } from "@/server/db/client";
import { updateBundleSchema, pricingConfigSchemaForMethod } from "@/server/lib/validation/bundles";
import { logger } from "@/server/lib/logger";
import type { Prisma } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/bundles/[id]";

/** Standard include clause for returning bundle with items. */
const BUNDLE_INCLUDE = {
  items: {
    where: { deletedAt: null },
    include: {
      product: {
        select: { id: true, name: true, basePrice: true },
      },
    },
  },
} as const;

/**
 * Fetches a single bundle by ID, including its product items.
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (API)
 */
export async function GET(
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

    const permResult = requirePermission(orgResult, "bundle.read");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    const { id } = await params;

    const bundle = await db.bundle.findFirst({
      where: { id, orgId: modResult.orgId, deletedAt: null },
      include: BUNDLE_INCLUDE,
    });

    if (!bundle) {
      return error("BUNDLE_NOT_FOUND", "Bundle not found.", 404);
    }

    return success(bundle);
  } catch (err) {
    logger.error("Failed to get bundle", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Updates an existing bundle. Supports partial updates (PATCH).
 * When productIds is provided, replaces all bundle items with the new set.
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (API)
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

    const permResult = requirePermission(orgResult, "bundle.manage");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    const { id } = await params;

    // Validate input
    const body = await req.json();
    const parsed = updateBundleSchema.safeParse(body);

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

    // Verify the bundle exists in the caller's org
    const existing = await db.bundle.findFirst({
      where: { id, orgId: modResult.orgId, deletedAt: null },
      select: { id: true, pricingMethod: true },
    });

    if (!existing) {
      return error("BUNDLE_NOT_FOUND", "Bundle not found.", 404);
    }

    // Validate pricing config if provided
    const effectiveMethod = parsed.data.pricingMethod ?? existing.pricingMethod;
    if (parsed.data.pricingConfig) {
      const pcParse = pricingConfigSchemaForMethod(effectiveMethod).safeParse(
        parsed.data.pricingConfig
      );
      if (!pcParse.success) {
        return error(
          "VALIDATION_ERROR",
          "Pricing configuration is invalid for the selected method.",
          400,
          pcParse.error.issues.map((i) => ({
            field: `pricingConfig.${i.path.join(".")}`,
            message: i.message,
          }))
        );
      }
    }

    // Case-insensitive duplicate check on rename
    if (parsed.data.name) {
      const duplicate = await db.bundle.findFirst({
        where: {
          orgId: modResult.orgId,
          deletedAt: null,
          id: { not: id },
          name: { equals: parsed.data.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        return error("BUNDLE_NAME_EXISTS", "A bundle with this name already exists.", 409);
      }
    }

    // Verify product IDs if provided
    if (parsed.data.productIds) {
      const products = await db.product.findMany({
        where: {
          id: { in: parsed.data.productIds },
          orgId: modResult.orgId,
          deletedAt: null,
        },
        select: { id: true },
      });
      const foundIds = new Set(products.map((p) => p.id));
      const missing = parsed.data.productIds.filter((pid) => !foundIds.has(pid));
      if (missing.length > 0) {
        return error(
          "INVALID_PRODUCTS",
          `Products not found: ${missing.join(", ")}`,
          400,
          { missingProductIds: missing }
        );
      }
    }

    // Build update data (exclude productIds — handled separately)
    const { productIds, ...updateFields } = parsed.data;
    const data: Prisma.BundleUpdateInput = {
      ...updateFields,
      pricingConfig: parsed.data.pricingConfig
        ? (parsed.data.pricingConfig as Prisma.InputJsonValue)
        : undefined,
      updatedBy: modResult.userId,
    };

    try {
      // If productIds provided, replace all items in a transaction
      if (productIds) {
        const bundle = await db.$transaction(async (tx) => {
          // Soft-delete existing items
          await tx.bundleItem.updateMany({
            where: { bundleId: id, deletedAt: null },
            data: { deletedAt: new Date() },
          });

          // Create new items
          await tx.bundleItem.createMany({
            data: productIds.map((productId) => ({
              orgId: modResult.orgId,
              bundleId: id,
              productId,
              quantity: 1,
            })),
          });

          // Update bundle fields
          return tx.bundle.update({
            where: { id },
            data,
            include: BUNDLE_INCLUDE,
          });
        });

        logger.info("Bundle updated (with items)", {
          ...ctx,
          userId: modResult.userId,
          orgId: modResult.orgId,
          bundleId: id,
        });
        return success(bundle);
      }

      // No item changes — just update fields
      const bundle = await db.bundle.update({
        where: { id },
        data,
        include: BUNDLE_INCLUDE,
      });

      logger.info("Bundle updated", {
        ...ctx,
        userId: modResult.userId,
        orgId: modResult.orgId,
        bundleId: id,
      });
      return success(bundle);
    } catch (dbErr) {
      if (
        dbErr instanceof Error &&
        "code" in dbErr &&
        (dbErr as { code: string }).code === "P2002"
      ) {
        return error("BUNDLE_NAME_EXISTS", "A bundle with this name already exists.", 409);
      }
      throw dbErr;
    }
  } catch (err) {
    logger.error("Failed to update bundle", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Soft-deletes a bundle and its items.
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (API)
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

    const permResult = requirePermission(orgResult, "bundle.manage");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    const { id } = await params;

    // Verify the bundle exists in the caller's org
    const existing = await db.bundle.findFirst({
      where: { id, orgId: modResult.orgId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return error("BUNDLE_NOT_FOUND", "Bundle not found.", 404);
    }

    // Soft-delete bundle + items in a transaction
    const now = new Date();
    await db.$transaction([
      db.bundleItem.updateMany({
        where: { bundleId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      db.bundle.update({
        where: { id },
        data: { deletedAt: now, updatedBy: modResult.userId },
      }),
    ]);

    logger.info("Bundle deleted", {
      ...ctx,
      userId: modResult.userId,
      orgId: modResult.orgId,
      bundleId: id,
    });
    return success({ message: "Bundle deleted successfully." });
  } catch (err) {
    logger.error("Failed to delete bundle", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
