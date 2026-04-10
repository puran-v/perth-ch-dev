/**
 * GET    /api/orgs/current/products — list products in the caller's org
 * POST   /api/orgs/current/products — create a product in the caller's org
 *
 * Both endpoints follow the standard guard chain
 * (requireAuth → requireOrg → requirePermission → requireModule)
 * and §2.1 — orgId is ALWAYS derived from the session, never the client.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */

// Author: Puran
// Impact: backend for the products list + Add Product page
// Reason: replaces the MOCK_PRODUCTS dataset wired into the catalogue and
//         the Save Changes / Create Product buttons in ProductEditorForm

import {
  requireAuth,
  requireOrg,
  requirePermission,
  requireModule,
} from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import {
  createProductSchema,
  listProductsQuerySchema,
} from "@/server/lib/validation/products";
import { pricingConfigSchemaForType } from "@/server/lib/validation/pricing";
import { parsePagination, paginationMeta } from "@/server/lib/pagination";
import { db } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { Prisma, ProductType } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/products";

/**
 * Returns a paginated list of products for the caller's organization.
 *
 * Supports the standard `page` / `limit` pagination params plus
 * optional filters: `search` (matches name or SKU), `category`,
 * `status`. Soft-deleted rows are excluded.
 *
 * Ordered by `createdAt desc` so newly added items appear at the
 * top of the catalogue list — matches the user expectation that
 * "the thing I just added is right there".
 *
 * @param req - Incoming request with session_token cookie
 * @returns Paginated products array (200) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
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

    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url.searchParams);

    // Author: Puran
    // Impact: filters are validated through the same Zod schema as the
    //         body so an unknown query value never silently slips into
    //         the Prisma where clause
    // Reason: §4.6 — every API input must pass Zod, query strings included
    const filterParse = listProductsQuerySchema.safeParse({
      search: url.searchParams.get("search") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });

    if (!filterParse.success) {
      return error(
        "VALIDATION_ERROR",
        "Please check your filters and try again.",
        400,
        filterParse.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      );
    }

    const filters = filterParse.data;

    // §2.1: orgId is always pinned to the caller's org. §5.3: filter
    // soft-deleted rows so the catalogue never surfaces "ghost" entries.
    //
    // Author: Puran
    // Impact: filter prefers categoryId (FK) over the legacy free-text
    //         category string. If both are sent, categoryId wins.
    // Reason: dual-write rollout — the new combobox sends categoryId,
    //         but the legacy `?category=` query param keeps working
    //         until every consumer migrates. After the legacy column
    //         is dropped, only categoryId remains.
    const where: Prisma.ProductWhereInput = {
      orgId: permResult.orgId,
      deletedAt: null,
      ...(filters.categoryId
        ? { categoryId: filters.categoryId }
        : filters.category
        ? { category: filters.category }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { sku: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        include: {
          // Author: Puran
          // Impact: ship the resolved category alongside each row so
          //         the list page can display the canonical name
          //         without an extra round-trip per row
          // Reason: the list table needs to show the category as the
          //         user would see it in the combobox, not the legacy
          //         free-text string. Cheap join — categories are a
          //         tiny per-org table.
          categoryRef: { select: { id: true, name: true, slug: true } },
          // Author: Puran
          // Impact: include variants on every list row so the list
          //         page can compute correct stock totals for
          //         SIZE_VARIANT products without N+1 fetches
          // Reason: §3 of the spec — for size_variant products the
          //         parent `quantity` column is unused. The list page
          //         needs to sum variant quantities to display the
          //         "total units" stat. Cheap join — variants per
          //         product top out at maybe 5-10 rows.
          variants: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      db.product.count({ where }),
    ]);

    return Response.json({
      success: true,
      data: products,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    logger.error("Failed to list products", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Creates a new product in the caller's organization.
 *
 * Requires `product.manage` (ADMIN + MANAGER). SKU is unique per org —
 * the case-insensitive duplicate check below catches "sku-001" vs
 * "SKU-001" before the DB unique index, since Postgres `@@unique` is
 * case-sensitive and the user expects them to be the same product.
 *
 * @param req - Incoming request with the create payload in JSON body
 * @returns Created product (201) or error response
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
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
    const parsed = createProductSchema.safeParse(body);

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

    // Author: Puran
    // Impact: case-insensitive duplicate SKU guard before the create
    // Reason: the @@unique([orgId, sku]) index in Postgres is case-sensitive,
    //         which means "SKU-001" and "sku-001" would both pass the DB
    //         constraint and the user would end up with two visually
    //         identical catalogue rows. Block here so the API matches the
    //         user's mental model of SKU equality.
    const duplicate = await db.product.findFirst({
      where: {
        orgId: permResult.orgId,
        deletedAt: null,
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

    // Author: Puran
    // Impact: resolve categoryId → ProductCategory row + dual-write
    //         the legacy `category` string column for the rollout
    //         phase
    // Reason: the form's combobox sends `categoryId`. The DB still has
    //         the NOT NULL `category` column from the old contract, so
    //         we read the category name once here and write both. The
    //         existence check also catches cross-tenant ids — if the
    //         caller sends a category id from another org we 400 it
    //         instead of leaking the row across tenants.
    let resolvedCategoryId: string | null = null;
    let resolvedCategoryName: string;
    if (parsed.data.categoryId) {
      const cat = await db.productCategory.findFirst({
        where: {
          id: parsed.data.categoryId,
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
      resolvedCategoryId = cat.id;
      resolvedCategoryName = cat.name;
    } else if (parsed.data.category) {
      // Legacy contract: free-text category was sent without an id.
      // The superRefine in createProductSchema guarantees we land
      // here with a non-empty string.
      resolvedCategoryName = parsed.data.category;
    } else {
      // Should be unreachable thanks to the superRefine, but keep
      // a defensive 400 so a logic bug never silently 500s.
      return error(
        "VALIDATION_ERROR",
        "Category is required.",
        400
      );
    }

    // Author: Puran
    // Impact: validate `pricingConfig` against the row's `productType`
    //         via the dedicated factory — single source of truth for
    //         the discriminator
    // Reason: caveat #1 from sign-off — the row's productType is the
    //         only place this lives. The JSON itself does NOT carry a
    //         productType field. The factory returns the right Zod
    //         schema for the row type (DimensionBased validation for
    //         DIMENSION_BASED, null/{} for the other three types).
    //         Doing this here instead of inside createProductSchema
    //         keeps the discriminator in exactly one place.
    const productType: ProductType =
      (parsed.data.productType as ProductType | undefined) ?? "STANDARD";
    const pricingConfigParse = pricingConfigSchemaForType(productType).safeParse(
      parsed.data.pricingConfig
    );
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
    const pricingConfig = pricingConfigParse.data;

    try {
      const product = await db.product.create({
        data: {
          orgId: permResult.orgId,
          name: parsed.data.name,
          sku: parsed.data.sku,
          category: resolvedCategoryName,
          categoryId: resolvedCategoryId,
          subcategory: parsed.data.subcategory ?? null,
          description: parsed.data.description ?? null,
          // Author: Puran
          // Impact: legacy `configurable` boolean stays for one more
          //         PR cycle, plus the new `productType` discriminator
          //         and the JSONB blobs for pricing rules + add-ons
          // Reason: dual-write rollout — drop `configurable` in the
          //         follow-up PR after the form has been on
          //         `productType` for a soak cycle (caveat #3).
          configurable: parsed.data.configurable ?? false,
          productType,
          // Prisma `Json` columns accept `null` to mean "store SQL
          // NULL"; passing `undefined` would be a no-op which is
          // wrong on create. The factory returns null for non-
          // DIMENSION_BASED types, so this is consistent.
          pricingConfig:
            pricingConfig as Prisma.InputJsonValue | typeof Prisma.JsonNull,
          addonGroups: (parsed.data.addonGroups ??
            []) as Prisma.InputJsonValue,
          status: parsed.data.status ?? "ACTIVE",
          quantity: parsed.data.quantity ?? 0,
          basePrice: parsed.data.basePrice ?? 0,
          setupMinutes: parsed.data.setupMinutes ?? 0,
          packdownMinutes: parsed.data.packdownMinutes ?? 0,
          images: parsed.data.images ?? [],
          tags: parsed.data.tags ?? [],
          createdBy: permResult.userId,
          updatedBy: permResult.userId,
        },
        include: {
          categoryRef: { select: { id: true, name: true, slug: true } },
          // Author: Puran
          // Impact: ship variants alongside the created row so the
          //         form's POST response hydrates the editor without
          //         a follow-up GET round-trip
          // Reason: §3 of the spec — variants are part of the
          //         product's identity for SIZE_VARIANT products.
          //         Empty array on first save is the expected state.
          variants: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      logger.info("Product created", {
        ...ctx,
        userId: permResult.userId,
        orgId: permResult.orgId,
        productId: product.id,
      });
      return success(product, 201);
    } catch (dbErr) {
      // P2002 = unique constraint on (orgId, sku) — race-condition safety
      // net for two concurrent creates with the exact same casing.
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
    logger.error("Failed to create product", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
