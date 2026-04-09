/**
 * POST /api/orgs/current/products/[id]/variants
 *
 * Creates a new variant on a SIZE_VARIANT product. Variants are how
 * size_variant products store per-variant pricing AND per-variant
 * inventory — see §3 of the Configurable Product Pricing spec.
 *
 * The product must:
 *   1. Belong to the caller's org (§2.1 — never trust client ids)
 *   2. NOT be soft-deleted
 *   3. Have productType === SIZE_VARIANT (we don't allow variants on
 *      STANDARD / DIMENSION_BASED / QUANTITY_ADDONS products — those
 *      have a single basePrice on the row)
 *
 * The variant label must be unique within the product (DB-enforced
 * via @@unique([productId, label])). Soft-deleted variants are
 * filtered at query time, so a deleted "Medium" CAN be recreated
 * under the same label after the soft delete.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Variants)
 */

// Author: Puran
// Impact: variants create endpoint for SIZE_VARIANT products
// Reason: §3 of the spec — size variants have their own price table
//         + per-variant inventory pool. The form mutates them via
//         this endpoint after the parent product save commits.

import {
  requireAuth,
  requireOrg,
  requirePermission,
  requireModule,
} from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { createVariantSchema } from "@/server/lib/validation/pricing";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { Prisma, ProductType } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/products/[id]/variants";

/**
 * Creates a new variant on a SIZE_VARIANT product. Returns the
 * created row including its generated `id` so the form can drop
 * it into local state without an extra refetch.
 *
 * @param req - Incoming request with the variant payload in JSON body
 * @param params - Route params with the parent product id
 * @returns Created variant (201) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Variants)
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

    const permResult = requirePermission(orgResult, "product.manage");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    const { id: productId } = await params;
    const body = await req.json();
    const parsed = createVariantSchema.safeParse(body);

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

    // §2.1 — verify the parent product exists in the caller's org
    // BEFORE any further work. Pull productType + deletedAt so we
    // can reject anything that isn't an active SIZE_VARIANT row.
    const product = await db.product.findFirst({
      where: { id: productId, orgId: permResult.orgId, deletedAt: null },
      select: { id: true, productType: true },
    });

    if (!product) {
      return error("PRODUCT_NOT_FOUND", "Product not found.", 404);
    }

    // Author: Puran
    // Impact: gate variants on the parent product's productType
    // Reason: variants only make sense for SIZE_VARIANT products.
    //         A DIMENSION_BASED marquee or a QUANTITY_ADDONS dunk
    //         tank shouldn't be growing a variants table — that's
    //         the kind of dirty-data trap Zod can't catch on its
    //         own (no FK constraint exists for "type must equal X").
    if (product.productType !== ProductType.SIZE_VARIANT) {
      return error(
        "PRODUCT_NOT_SIZE_VARIANT",
        "Variants can only be added to SIZE_VARIANT products.",
        400
      );
    }

    try {
      const variant = await db.productVariant.create({
        data: {
          orgId: permResult.orgId,
          productId,
          label: parsed.data.label,
          description: parsed.data.description ?? null,
          priceDay: parsed.data.priceDay,
          priceHalfday: parsed.data.priceHalfday ?? null,
          priceOvernight: parsed.data.priceOvernight ?? null,
          quantity: parsed.data.quantity,
          skuSuffix: parsed.data.skuSuffix ?? null,
          sortOrder: parsed.data.sortOrder ?? 0,
          active: parsed.data.active ?? true,
          createdBy: permResult.userId,
          updatedBy: permResult.userId,
        },
      });

      logger.info("Variant created", {
        ...ctx,
        userId: permResult.userId,
        orgId: permResult.orgId,
        productId,
        variantId: variant.id,
      });
      return success(variant, 201);
    } catch (dbErr) {
      // P2002 = unique constraint on (productId, label) — two variants
      // can't share a label on the same product.
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
    logger.error("Failed to create variant", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
