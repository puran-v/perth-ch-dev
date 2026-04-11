/**
 * Zod validation schemas for the Products API (Module A — Products).
 *
 * Per PROJECT_RULES §4.6: every API route MUST validate input with Zod
 * before any business logic. This file is the single source of truth for
 * the wire shape of a Product so the route handlers, the form, and the
 * generated TypeScript types can never drift.
 *
 * The shapes here intentionally mirror `ProductDetail` in the UI
 * (`src/lib/mock-products.ts`) — when the mock dataset is deleted in
 * favour of `useProducts()`, the form will POST/PATCH this exact body.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (validation)
 */

// Author: Puran
// Impact: Zod schemas for Product create / update / list endpoints
// Reason: §4.6 non-negotiable input validation; keeps the API contract
//         in one file rather than scattered across the route handlers

import { z } from "zod";
import { addonGroupsSchema } from "@/server/lib/validation/pricing";

// Author: Puran
// Impact: products schemas now accept productType + pricingConfig +
//         addonGroups
// Reason: Configurable Product Pricing spec — every product carries
//         a productType discriminator and (for DIMENSION_BASED) a
//         pricingConfig JSON blob. addonGroups is optional on every
//         type. The pricingConfig JSON itself is validated at the
//         route handler via `pricingConfigSchemaForType(productType)`
//         so the row's productType is the only discriminator (caveat
//         #1 from sign-off). Here we leave it as `z.unknown()` —
//         shape-checked separately, type-narrowed in TS via the
//         dedicated factory.

/** Product pricing model — single source of truth on the row. */
export const productTypeSchema = z.enum([
  "STANDARD",
  "DIMENSION_BASED",
  "SIZE_VARIANT",
  "QUANTITY_ADDONS",
]);

// ── Shared field schemas ─────────────────────────────────────────────

// Author: Puran
// Impact: image upload contract — base64 data URLs stored directly in
//         products.images (text[]) for V1, mirroring how Branding stores
//         the org logo in OrgSetup.branding.logoDataUrl
// Reason: there is no object storage configured yet (no S3 / R2 / etc.).
//         The whole codebase persists images as data URLs in Postgres
//         until storage lands. Doing the same thing here keeps a single
//         pattern instead of inventing a second one. When real storage
//         is wired up, both Branding and Products migrate together.

/**
 * Per-image upper bound. A 2 MB raw file becomes ~2.67 MB after base64
 * expansion; the buffer covers the `data:image/<subtype>;base64,` prefix
 * and the trailing padding chars. Mirrors `LOGO_DATA_URL_MAX_BYTES` in
 * the branding schema so both forms enforce the same effective 2 MB cap.
 */
const PRODUCT_IMAGE_MAX_BYTES = 2_750_000;

/** Maximum number of images a single product can carry. */
const PRODUCT_IMAGE_MAX_COUNT = 10;

/**
 * Allowed image formats for product photos: PNG, JPG, WebP.
 *
 * SVG and GIF are intentionally excluded:
 *   - SVG is a vector / XML format — wrong for photos and a known XSS
 *     vector when rendered inline (it can carry <script>).
 *   - GIF is dated and bloated relative to WebP for the same use case.
 *
 * Branding allows SVG because logos are vector by design; product photos
 * are raster and should stay raster.
 */
const productImageDataUrlRegex =
  /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

/** Single image data URL — format + size cap. */
const productImageDataUrl = z
  .string()
  .min(1, "Image cannot be empty")
  .max(PRODUCT_IMAGE_MAX_BYTES, "Each image must be 2 MB or less")
  .refine(
    (v) => productImageDataUrlRegex.test(v),
    "Image must be a PNG, JPG, or WebP file"
  );

/**
 * Lifecycle state of a catalogue product. Mirrors the `ProductStatus`
 * Postgres enum and the `ProductStatus` TS union exported from
 * `src/types/products.ts` so all three layers always agree.
 */
export const productStatusSchema = z.enum([
  "ACTIVE",
  "MAINTENANCE",
  "NO_PRICE",
  "INACTIVE",
]);

/** Trim → reject empty → cap length, used by name / sku / category. */
const shortText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or less`);

/** Optional, nullable, trimmed text field used by sub-category / description. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or less`)
    .optional()
    .nullable();

// ── Create / update body ─────────────────────────────────────────────

/**
 * Full create payload. Every required field must be present and valid.
 * The `partial()` variant exported below is used by PATCH so the form
 * can submit only the fields the user actually changed.
 *
 * Money: `basePrice` is whole-dollar integer for V1 (matches the
 * `Product.basePrice` Int column). When we move to per-cent pricing
 * this becomes `basePriceCents` and only this schema needs updating.
 *
 * Images / tags: arrays of plain strings — the route writes them
 * directly to the Postgres text[] columns. We cap both lists to keep
 * payload size sane and to give the UI a hard limit to surface.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (validation)
 */
export const createProductSchema = z.object({
  name: shortText("Product name", 200),
  sku: shortText("SKU", 80),
  // Author: Puran
  // Impact: dual-write rollout — accept the new categoryId FK as the
  //         preferred field, fall back to the legacy free-text
  //         `category` for any caller still on the old contract
  // Reason: ships in the same PR as the schema migration. The route
  //         handler resolves whichever one is present, validates
  //         categoryId belongs to the caller's org, and writes BOTH
  //         columns so neither read path goes stale during rollout.
  //         A follow-up PR drops `category` once the form has soaked.
  categoryId: z.string().cuid({ message: "Invalid category id" }).optional(),
  category: shortText("Category", 80).optional(),
  subcategory: optionalText(80),
  description: optionalText(2000),
  // Author: Puran
  // Impact: legacy `configurable` boolean stays during the dual-write
  //         rollout (caveat #3 from sign-off)
  // Reason: form switches to `productType` next, drops `configurable`
  //         in the follow-up PR
  configurable: z.boolean().optional(),
  // Author: Puran
  // Impact: new `productType` discriminator + JSONB blobs for the
  //         four pricing models
  // Reason: §1-3 of the Configurable Product Pricing spec. The
  //         pricingConfig JSON is left as `unknown` here — the
  //         route handler validates its shape via
  //         `pricingConfigSchemaForType(productType)` so the row's
  //         productType is the single discriminator (caveat #1).
  productType: productTypeSchema.optional(),
  pricingConfig: z.unknown().optional(),
  addonGroups: addonGroupsSchema.optional(),
  status: productStatusSchema.optional(),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative")
    .max(100000, "Quantity is too large")
    .optional(),
  basePrice: z
    .number()
    .int("Base price must be a whole-dollar amount")
    .min(0, "Price cannot be negative")
    .max(10_000_000, "Price is too large")
    .optional(),
  setupMinutes: z
    .number()
    .int("Setup minutes must be a whole number")
    .min(0, "Setup minutes cannot be negative")
    .max(1440, "Setup minutes cannot exceed 1440 (24h)")
    .optional(),
  packdownMinutes: z
    .number()
    .int("Pack-down minutes must be a whole number")
    .min(0, "Pack-down minutes cannot be negative")
    .max(1440, "Pack-down minutes cannot exceed 1440 (24h)")
    .optional(),
  // Operational tab — staffing
  staffSetup: z
    .number()
    .int("Staff count must be a whole number")
    .min(0, "Staff count cannot be negative")
    .max(99, "Staff count cannot exceed 99")
    .optional(),
  staffOperate: z
    .number()
    .int("Staff count must be a whole number")
    .min(0, "Staff count cannot be negative")
    .max(99, "Staff count cannot exceed 99")
    .optional(),
  // Operational tab — dimensions + weight (nullable so the editor can clear them)
  lengthM: z
    .number()
    .min(0, "Length cannot be negative")
    .max(1000, "Length cannot exceed 1000 m")
    .nullable()
    .optional(),
  widthM: z
    .number()
    .min(0, "Width cannot be negative")
    .max(1000, "Width cannot exceed 1000 m")
    .nullable()
    .optional(),
  heightM: z
    .number()
    .min(0, "Height cannot be negative")
    .max(1000, "Height cannot exceed 1000 m")
    .nullable()
    .optional(),
  weightKg: z
    .number()
    .min(0, "Weight cannot be negative")
    .max(100000, "Weight cannot exceed 100000 kg")
    .nullable()
    .optional(),
  truckSpaceUnits: z
    .number()
    .int("Truck space must be a whole number")
    .min(0, "Truck space cannot be negative")
    .max(99, "Truck space cannot exceed 99")
    .nullable()
    .optional(),
  // Operational tab — handling flags (mix of presets + custom strings)
  handlingFlags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Flag cannot be empty")
        .max(80, "Flag must be 80 characters or less")
    )
    .max(30, "A product can have at most 30 handling flags")
    .optional(),
  // Warehouse tab — physical location (all nullable text)
  warehouseZone: optionalText(80),
  warehouseBayShelf: optionalText(80),
  warehouseLocationNotes: optionalText(500),
  // Warehouse tab — built-in post-job toggles
  requiresCleaning: z.boolean().optional(),
  requiresCharging: z.boolean().optional(),
  requiresConsumableCheck: z.boolean().optional(),
  requiresInspection: z.boolean().optional(),
  // Warehouse tab — custom post-job rule titles
  customPostJobRules: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Rule name cannot be empty")
        .max(120, "Rule name must be 120 characters or less")
    )
    .max(20, "A product can have at most 20 custom post-job rules")
    .optional(),
  // Notes & Rules tab — long-form free text per audience.
  // 5000 char cap per field is generous (~1000 words) but still bounds
  // the payload so a runaway paste can't blow the request size.
  salesNotes: optionalText(5000),
  warehouseNotes: optionalText(5000),
  aiRules: optionalText(5000),
  images: z
    .array(productImageDataUrl)
    .max(
      PRODUCT_IMAGE_MAX_COUNT,
      `A product can have at most ${PRODUCT_IMAGE_MAX_COUNT} images`
    )
    .optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag cannot be empty")
        .max(40, "Tag must be 40 characters or less")
    )
    .max(30, "A product can have at most 30 tags")
    .optional(),
}).superRefine((data, ctx) => {
  // Author: Puran
  // Impact: at least one of categoryId / category must be present on
  //         create. Both being absent would crash the Prisma insert
  //         because `products.category` is NOT NULL — surface a clean
  //         400 here instead of leaking the DB error.
  // Reason: dual-write rollout phase. Once `category` is dropped in
  //         the follow-up PR, this guard becomes a plain
  //         `categoryId.required()` and the superRefine goes away.
  if (!data.categoryId && (!data.category || data.category.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categoryId"],
      message: "Category is required",
    });
  }
});

/**
 * Partial schema for PATCH /products/[id]. Every field is optional but
 * each present field is still validated by the same rules as create.
 *
 * Note: PATCH does NOT enforce the "categoryId or category required"
 * guard from the create schema because a partial update may legitimately
 * omit both (e.g. the user is only changing the price).
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (validation)
 */
export const updateProductSchema = z.object({
  name: shortText("Product name", 200).optional(),
  sku: shortText("SKU", 80).optional(),
  categoryId: z.string().cuid({ message: "Invalid category id" }).optional(),
  category: shortText("Category", 80).optional(),
  subcategory: optionalText(80),
  description: optionalText(2000),
  // Author: Puran
  // Impact: legacy `configurable` boolean stays during the dual-write
  //         rollout (caveat #3 from sign-off)
  // Reason: form switches to `productType` next, drops `configurable`
  //         in the follow-up PR
  configurable: z.boolean().optional(),
  // Author: Puran
  // Impact: new `productType` discriminator + JSONB blobs for the
  //         four pricing models
  // Reason: §1-3 of the Configurable Product Pricing spec. The
  //         pricingConfig JSON is left as `unknown` here — the
  //         route handler validates its shape via
  //         `pricingConfigSchemaForType(productType)` so the row's
  //         productType is the single discriminator (caveat #1).
  productType: productTypeSchema.optional(),
  pricingConfig: z.unknown().optional(),
  addonGroups: addonGroupsSchema.optional(),
  status: productStatusSchema.optional(),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative")
    .max(100000, "Quantity is too large")
    .optional(),
  basePrice: z
    .number()
    .int("Base price must be a whole-dollar amount")
    .min(0, "Price cannot be negative")
    .max(10_000_000, "Price is too large")
    .optional(),
  setupMinutes: z
    .number()
    .int("Setup minutes must be a whole number")
    .min(0, "Setup minutes cannot be negative")
    .max(1440, "Setup minutes cannot exceed 1440 (24h)")
    .optional(),
  packdownMinutes: z
    .number()
    .int("Pack-down minutes must be a whole number")
    .min(0, "Pack-down minutes cannot be negative")
    .max(1440, "Pack-down minutes cannot exceed 1440 (24h)")
    .optional(),
  staffSetup: z
    .number()
    .int("Staff count must be a whole number")
    .min(0, "Staff count cannot be negative")
    .max(99, "Staff count cannot exceed 99")
    .optional(),
  staffOperate: z
    .number()
    .int("Staff count must be a whole number")
    .min(0, "Staff count cannot be negative")
    .max(99, "Staff count cannot exceed 99")
    .optional(),
  lengthM: z.number().min(0).max(1000).nullable().optional(),
  widthM: z.number().min(0).max(1000).nullable().optional(),
  heightM: z.number().min(0).max(1000).nullable().optional(),
  weightKg: z.number().min(0).max(100000).nullable().optional(),
  truckSpaceUnits: z
    .number()
    .int()
    .min(0)
    .max(99)
    .nullable()
    .optional(),
  handlingFlags: z
    .array(z.string().trim().min(1).max(80))
    .max(30)
    .optional(),
  warehouseZone: optionalText(80),
  warehouseBayShelf: optionalText(80),
  warehouseLocationNotes: optionalText(500),
  requiresCleaning: z.boolean().optional(),
  requiresCharging: z.boolean().optional(),
  requiresConsumableCheck: z.boolean().optional(),
  requiresInspection: z.boolean().optional(),
  customPostJobRules: z
    .array(z.string().trim().min(1).max(120))
    .max(20)
    .optional(),
  salesNotes: optionalText(5000),
  warehouseNotes: optionalText(5000),
  aiRules: optionalText(5000),
  images: z
    .array(productImageDataUrl)
    .max(PRODUCT_IMAGE_MAX_COUNT)
    .optional(),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(30)
    .optional(),
});

// ── List query params ────────────────────────────────────────────────

/**
 * Query params accepted by GET /products. All optional. Pagination
 * (`page` / `limit`) is parsed separately by `parsePagination()` —
 * this schema only covers the product-specific filters so the route
 * can layer them on top of the standard pagination contract.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (validation)
 */
export const listProductsQuerySchema = z.object({
  /** Free-text search across name + sku (case-insensitive contains). */
  search: z.string().trim().max(200).optional(),
  /**
   * Filter by category id (preferred) or legacy free-text category
   * string. The route accepts both during the dual-write rollout
   * phase: callers on the old contract can keep sending `?category=`,
   * and the new combobox sends `?categoryId=`. After the legacy
   * column is dropped, only `categoryId` survives.
   */
  categoryId: z.string().cuid({ message: "Invalid category id" }).optional(),
  category: z.string().trim().max(80).optional(),
  /** Filter by lifecycle status. */
  status: productStatusSchema.optional(),
});

// ── Inferred types ───────────────────────────────────────────────────

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
