/**
 * PATCH  /api/orgs/current/products/[id]/variants/[variantId]
 * DELETE /api/orgs/current/products/[id]/variants/[variantId]
 *
 * Update + soft-delete endpoints for a single product variant. Both
 * verify the variant exists in the caller's org AND is attached to
 * the URL's parent product before any write — §2.1.
 *
 * V1 DELETE policy: variants are soft-deleted unconditionally
 * because reservations don't exist yet. When the reservations table
 * lands, the DELETE handler grows a count check that returns 409
 * `VARIANT_IN_USE` with the active reservation count — same pattern
 * as categories.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Variants)
 */

// Author: Puran
// Impact: variants update + soft-delete handlers
// Reason: full CRUD round-trip for size variants. The form mutates
//         them via these endpoints inside its `handleSave` flow
//         after the parent product save commits.

import {
  requireAuth,
  requireOrg,
  requirePermission,
  requireModule,
} from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { updateVariantSchema } from "@/server/lib/validation/pricing";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { Prisma } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/products/[id]/variants/[variantId]";

/**
 * Partially updates a variant. Only fields present in the body are
 * written. The variant must belong to the caller's org AND be
 * attached to the URL's parent product — anything else returns 404.
 *
 * @param req - Incoming request with partial variant fields in body
 * @param params - Route params with parent product id + variant id
 * @returns Updated variant (200) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Variants)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
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

    const { id: productId, variantId } = await params;
    const body = await req.json();
    const parsed = updateVariantSchema.safeParse(body);

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

    // §2.1 — verify the variant exists in the caller's org AND is
    // attached to the URL's parent product. Both conditions in one
    // query so a malicious client can't pair a variant id from one
    // org with a product id from another.
    const existing = await db.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
        orgId: permResult.orgId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return error("VARIANT_NOT_FOUND", "Variant not found.", 404);
    }

    // Build the update payload from only the fields that were sent.
    // Spreading parsed.data straight into Prisma is safe because Zod
    // has already stripped unknown keys and validated each field.
    const data: Prisma.ProductVariantUpdateInput = {
      ...parsed.data,
      updatedBy: permResult.userId,
    };

    try {
      const variant = await db.productVariant.update({
        where: { id: variantId },
        data,
      });

      logger.info("Variant updated", {
        ...ctx,
        userId: permResult.userId,
        orgId: permResult.orgId,
        productId,
        variantId,
      });
      return success(variant);
    } catch (dbErr) {
      // P2002 = unique constraint on (productId, label)
      if (
        dbErr instanceof Prisma.PrismaClientKnownRequestError &&
        dbErr.code === "P2002"
      ) {
        return error(
          "VARIANT_LABEL_EXISTS",
          "A variant with this label already exists on this product.",
          409
        );
      }
      throw dbErr;
    }
  } catch (err) {
    logger.error("Failed to update variant", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Soft-deletes a product variant (§5.3 — never hard delete).
 *
 * V1: unconditional soft delete because the reservations table
 * doesn't exist yet. When it lands, this handler grows a count
 * check identical to the categories DELETE — block with
 * `VARIANT_IN_USE` 409 if any active reservation references this
 * variant id, surface the count so the UI can prompt the admin to
 * reassign first.
 *
 * @param req - Incoming request with session_token cookie
 * @param params - Route params with parent product id + variant id
 * @returns Success message (200) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Variants)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
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

    const { id: productId, variantId } = await params;

    const existing = await db.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
        orgId: permResult.orgId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return error("VARIANT_NOT_FOUND", "Variant not found.", 404);
    }

    // TODO(reservations): when the reservations table lands, count
    // active rows that reference this variantId and return 409
    // `VARIANT_IN_USE` if > 0. Mirror the categories DELETE pattern
    // for the count + reassign-first messaging.

    // Soft delete — set deletedAt (§5.3 never hard delete)
    await db.productVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date(), updatedBy: permResult.userId },
    });

    logger.info("Variant deleted", {
      ...ctx,
      userId: permResult.userId,
      orgId: permResult.orgId,
      productId,
      variantId,
    });
    return success({ message: "Variant deleted successfully." });
  } catch (err) {
    logger.error("Failed to delete variant", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
