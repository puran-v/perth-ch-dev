/**
 * GET    /api/orgs/current/products/[id] — fetch a single product
 * PATCH  /api/orgs/current/products/[id] — partial update of a product
 * DELETE /api/orgs/current/products/[id] — soft-delete a product (§5.3)
 *
 * Every handler verifies the row belongs to the caller's org before
 * any read or write — §2.1, never trust client-sent IDs.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */

// Author: Puran
// Impact: detail / edit / archive endpoints for a single product
// Reason: backs the Product Details page (load + Save Changes + Discard)

import {
  requireAuth,
  requireOrg,
  requirePermission,
  requireModule,
} from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { updateProductSchema } from "@/server/lib/validation/products";
import { pricingConfigSchemaForType } from "@/server/lib/validation/pricing";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { Prisma, ProductType } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/products/[id]";

/**
 * Returns one product by id, scoped to the caller's org.
 * 404 if the row does not exist OR belongs to another tenant — we
 * never leak existence across orgs.
 *
 * @param req - Incoming request with session_token cookie
 * @param params - Route params (awaited per Next.js 16 async API)
 * @returns Product (200) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
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

    const permResult = requirePermission(orgResult, "product.read");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    const { id } = await params;

    // Author: Puran
    // Impact: include categoryRef + variants so the editor hydrates
    //         from a single API call (no separate variants lookup
    //         needed for the just-loaded product)
    // Reason: response shape contract — the Configuration tab needs
    //         the variant rows to populate the Size variants list,
    //         and the Basic Info tab needs the categoryRef to populate
    //         the combobox label. Both joins are tiny per-product.
    const product = await db.product.findFirst({
      where: { id, orgId: permResult.orgId, deletedAt: null },
      include: {
        categoryRef: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!product) {
      return error("PRODUCT_NOT_FOUND", "Product not found.", 404);
    }

    return success(product);
  } catch (err) {
    logger.error("Failed to fetch product", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Partially updates a product. Only fields present in the body are
 * written. The row must belong to the caller's org — anything else
 * returns 404 (we don't leak cross-tenant existence).
 *
 * SKU rename is allowed but goes through the same case-insensitive
 * uniqueness check as create so two products in the same org can
 * never share a SKU regardless of casing.
 *
 * @param req - Incoming request with partial product fields in body
 * @param params - Route params with product id
 * @returns Updated product (200) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
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
    const parsed = updateProductSchema.safeParse(body);

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

    // Verify the row exists in the caller's org BEFORE any further work.
    // §2.1 — pinned org scope; never trust the URL id alone.
    // Author: Puran
    // Impact: pull `productType` so the pricingConfig validation
    //         downstream knows which schema to apply when the patch
    //         body doesn't include a productType field
    // Reason: caveat #1 — productType is the single discriminator.
    //         If the patch doesn't change it, we still need to
    //         validate any pricingConfig in the payload against the
    //         CURRENT row type, not against an undefined value.
    const existing = await db.product.findFirst({
      where: { id, orgId: permResult.orgId, deletedAt: null },
      select: { id: true, sku: true, productType: true },
    });

    if (!existing) {
      return error("PRODUCT_NOT_FOUND", "Product not found.", 404);
    }

    // Author: Puran
    // Impact: case-insensitive duplicate SKU guard on rename
    // Reason: same rationale as the create handler — Postgres unique
    //         index on (orgId, sku) is case-sensitive, so we have to
    //         block the dup at the API layer to honour the user's
    //         expectation that "SKU-001" and "sku-001" are equal.
    //         Skip the check entirely when the SKU is unchanged or omitted.
    if (parsed.data.sku && parsed.data.sku !== existing.sku) {
      const duplicate = await db.product.findFirst({
        where: {
          orgId: permResult.orgId,
          deletedAt: null,
          id: { not: id },
          sku: { equals: parsed.data.sku, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        return error(
          "PRODUCT_SKU_EXISTS",
          "A product with this SKU already exists.",
          409
        );
      }
    }

    // Author: Puran
    // Impact: resolve categoryId → ProductCategory row + dual-write
    //         the legacy `category` string column on rename
    // Reason: same rationale as the create handler. The PATCH path
    //         only runs this branch when categoryId is in the payload,
    //         so updates that don't touch the category field (e.g.
    //         price-only edits) skip the join entirely.
    const {
      categoryId: incomingCategoryId,
      category: incomingCategory,
      productType: incomingProductType,
      pricingConfig: incomingPricingConfig,
      addonGroups: incomingAddonGroups,
      ...rest
    } = parsed.data;
    let categoryWrite: {
      categoryId?: string | null;
      category?: string;
    } = {};

    if (incomingCategoryId) {
      const cat = await db.productCategory.findFirst({
        where: {
          id: incomingCategoryId,
          orgId: permResult.orgId,
          deletedAt: null,
        },
        select: { id: true, name: true },
      });
      if (!cat) {
        return error(
          "INVALID_CATEGORY",
          "Selected category does not exist in your organization.",
          400
        );
      }
      categoryWrite = { categoryId: cat.id, category: cat.name };
    } else if (incomingCategory) {
      // Legacy contract — caller sent the free-text category. Keep it
      // in sync but DON'T null out categoryId. If the row was
      // previously linked to a real category, the next form save
      // will re-link it through the combobox.
      categoryWrite = { category: incomingCategory };
    }

    // Author: Puran
    // Impact: validate pricingConfig against the EFFECTIVE productType
    //         — either the new one in the patch body, or the existing
    //         row type if the patch doesn't change it
    // Reason: caveat #1 — single discriminator. Switching productType
    //         on a row in the same patch body that also updates
    //         pricingConfig is a legitimate flow (the form may flip
    //         from STANDARD → DIMENSION_BASED in one save), so we
    //         resolve the effective type FIRST, then validate the
    //         JSON shape against it. If pricingConfig isn't in the
    //         patch, we skip validation entirely — the existing row
    //         data stays put.
    const effectiveProductType: ProductType =
      (incomingProductType as ProductType | undefined) ?? existing.productType;
    let pricingConfigWrite:
      | { pricingConfig: Prisma.InputJsonValue | typeof Prisma.JsonNull }
      | Record<string, never> = {};
    if (
      incomingPricingConfig !== undefined ||
      incomingProductType !== undefined
    ) {
      // The pricing config is in the body, OR the type changed
      // (which means the existing config might no longer be valid
      // for the new type). Validate against the effective type.
      // When type changes but pricingConfig is omitted, we treat
      // it as null — the old config was for the old type and
      // shouldn't survive a type switch.
      const candidate =
        incomingPricingConfig !== undefined ? incomingPricingConfig : null;
      const pricingConfigParse =
        pricingConfigSchemaForType(effectiveProductType).safeParse(candidate);
      if (!pricingConfigParse.success) {
        return error(
          "VALIDATION_ERROR",
          "Pricing configuration is invalid for this product type.",
          400,
          pricingConfigParse.error.issues.map((i) => ({
            field: `pricingConfig.${i.path.join(".")}`,
            message: i.message,
          }))
        );
      }
      pricingConfigWrite = {
        pricingConfig: (pricingConfigParse.data ??
          Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
      };
    }

    // Build the update payload from only the fields that were sent.
    // Spreading parsed.data straight into Prisma is safe because Zod
    // has already stripped unknown keys and validated each field.
    const data: Prisma.ProductUpdateInput = {
      ...rest,
      ...categoryWrite,
      ...(incomingProductType !== undefined
        ? { productType: incomingProductType as ProductType }
        : {}),
      ...pricingConfigWrite,
      ...(incomingAddonGroups !== undefined
        ? { addonGroups: incomingAddonGroups as Prisma.InputJsonValue }
        : {}),
      updatedBy: permResult.userId,
    };

    try {
      const product = await db.product.update({
        where: { id },
        data,
        include: {
          categoryRef: { select: { id: true, name: true, slug: true } },
          variants: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      logger.info("Product updated", {
        ...ctx,
        userId: permResult.userId,
        orgId: permResult.orgId,
        productId: id,
      });
      return success(product);
    } catch (dbErr) {
      if (
        dbErr instanceof Prisma.PrismaClientKnownRequestError &&
        dbErr.code === "P2002"
      ) {
        return error(
          "PRODUCT_SKU_EXISTS",
          "A product with this SKU already exists.",
          409
        );
      }
      throw dbErr;
    }
  } catch (err) {
    logger.error("Failed to update product", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Soft-deletes a product (§5.3 — never hard delete). The row stays
 * in the DB so historical bookings can still resolve a product name,
 * but it's hidden from the catalogue list and the quote builder
 * because every list query filters `deletedAt = null`.
 *
 * @param req - Incoming request with session_token cookie
 * @param params - Route params with product id
 * @returns Success message (200) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
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

    const existing = await db.product.findFirst({
      where: { id, orgId: permResult.orgId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return error("PRODUCT_NOT_FOUND", "Product not found.", 404);
    }

    // Author: Puran
    // Impact: cascade soft-delete to all of the product's variants in
    //         the same transaction
    // Reason: §3 of the spec — variants are part of a product's
    //         identity for SIZE_VARIANT products. Archiving the
    //         parent must hide the variants too, otherwise an admin
    //         would re-find them via direct API access and the
    //         editor would render orphaned rows. Single transaction
    //         so a partial failure can't leave variants alive after
    //         the parent is archived.
    const now = new Date();
    await db.$transaction([
      db.product.update({
        where: { id },
        data: { deletedAt: now, updatedBy: permResult.userId },
      }),
      db.productVariant.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: now, updatedBy: permResult.userId },
      }),
    ]);

    logger.info("Product deleted", {
      ...ctx,
      userId: permResult.userId,
      orgId: permResult.orgId,
      productId: id,
    });
    return success({ message: "Product deleted successfully." });
  } catch (err) {
    logger.error("Failed to delete product", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
