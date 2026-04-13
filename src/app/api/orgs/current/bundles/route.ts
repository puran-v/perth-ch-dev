/**
 * Bundles list + create API — Module A step 5.
 *
 * GET  /api/orgs/current/bundles  → paginated list of bundles (with items)
 * POST /api/orgs/current/bundles  → create a new bundle with product items
 *
 * Follows the guard chain: Auth → Org → Permission → Module A (§6.3).
 * orgId is always derived from session, never from client (§2.1).
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (API)
 */

// Author: samir
// Impact: CRUD endpoints for the bundles catalogue
// Reason: bundles page was UI-only with mock data — this wires the backend

import { requireAuth, requireOrg, requirePermission, requireModule } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { db } from "@/server/db/client";
import { parsePagination, paginationMeta } from "@/server/lib/pagination";
import { createBundleSchema, listBundlesQuerySchema, pricingConfigSchemaForMethod } from "@/server/lib/validation/bundles";
import { logger } from "@/server/lib/logger";
import type { Prisma } from "@/generated/prisma/client";

const ROUTE = "/api/orgs/current/bundles";

/**
 * Lists bundles for the caller's org, paginated and optionally filtered.
 *
 * @param req - Incoming GET request with optional ?page, ?limit, ?search, ?type query params
 * @returns Paginated list of bundles with their product items
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (API)
 */
export async function GET(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Guard chain: Auth → Org → Permission → Module A
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "bundle.read");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    // Parse pagination and filters
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url.searchParams);

    const filterParse = listBundlesQuerySchema.safeParse({
      search: url.searchParams.get("search") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
    });
    if (!filterParse.success) {
      return error(
        "VALIDATION_ERROR",
        "Invalid query parameters.",
        400,
        filterParse.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      );
    }

    const filters = filterParse.data;

    // Build tenant-scoped where clause
    const where: Prisma.BundleWhereInput = {
      orgId: modResult.orgId,
      deletedAt: null,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.search
        ? {
            name: { contains: filters.search, mode: "insensitive" as const },
          }
        : {}),
    };

    // Fetch bundles + count in parallel (no N+1 — §17)
    const [bundles, total] = await Promise.all([
      db.bundle.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        include: {
          items: {
            where: { deletedAt: null },
            include: {
              product: {
                select: { id: true, name: true, basePrice: true },
              },
            },
          },
        },
      }),
      db.bundle.count({ where }),
    ]);

    return Response.json({
      success: true,
      data: bundles,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    logger.error("Failed to list bundles", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}

/**
 * Creates a new bundle with product items.
 *
 * @param req - Incoming POST request with bundle data in JSON body
 * @returns The created bundle with items
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (API)
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Guard chain
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const orgResult = requireOrg(authResult);
    if (orgResult instanceof Response) return orgResult;

    const permResult = requirePermission(orgResult, "bundle.manage");
    if (permResult instanceof Response) return permResult;

    const modResult = requireModule(permResult, "A");
    if (modResult instanceof Response) return modResult;

    // Validate input
    const body = await req.json();
    const parsed = createBundleSchema.safeParse(body);

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

    // Validate pricing config against the selected method
    const effectiveMethod = parsed.data.pricingMethod ?? "TIERED";
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

    // Case-insensitive duplicate name check
    const duplicate = await db.bundle.findFirst({
      where: {
        orgId: modResult.orgId,
        deletedAt: null,
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return error("BUNDLE_NAME_EXISTS", "A bundle with this name already exists.", 409);
    }

    // Verify all product IDs belong to this org and are active
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

    // Create bundle + items in a transaction
    try {
      const bundle = await db.bundle.create({
        data: {
          orgId: modResult.orgId,
          name: parsed.data.name,
          type: parsed.data.type,
          pricingMethod: effectiveMethod,
          pricingConfig: (parsed.data.pricingConfig as Prisma.InputJsonValue) ?? undefined,
          bundlePrice: parsed.data.bundlePrice ?? 0,
          savings: parsed.data.savings ?? 0,
          suggestedEventTypes: parsed.data.suggestedEventTypes ?? null,
          internalNotes: parsed.data.internalNotes ?? null,
          createdBy: modResult.userId,
          updatedBy: modResult.userId,
          items: {
            create: parsed.data.productIds.map((productId) => ({
              orgId: modResult.orgId,
              productId,
              quantity: 1,
            })),
          },
        },
        include: {
          items: {
            where: { deletedAt: null },
            include: {
              product: {
                select: { id: true, name: true, basePrice: true },
              },
            },
          },
        },
      });

      logger.info("Bundle created", {
        ...ctx,
        userId: modResult.userId,
        orgId: modResult.orgId,
        bundleId: bundle.id,
      });
      return success(bundle, 201);
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
    logger.error("Failed to create bundle", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
