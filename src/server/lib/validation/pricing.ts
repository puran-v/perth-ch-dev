/**
 * Zod validation for the configurable product pricing models
 * (Module A — Products / Pricing Models).
 *
 * Backs §1-3 + §5 of the Configurable Product Pricing developer
 * spec. The shapes here mirror exactly what `pricingConfig` and
 * `addonGroups` JSONB columns can hold on a `Product` row, and
 * what a `ProductVariant` row looks like on the wire.
 *
 * Single-source-of-truth principle: the row's `productType` is the
 * ONLY discriminator. `pricingConfig` validation is selected from
 * `productType` via the `pricingConfigSchemaForType` factory below
 * — the JSON does NOT carry its own `productType` field. This
 * prevents the row flag and the JSON shape from drifting (which
 * would be a particularly nasty bug to debug because both layers
 * would parse independently).
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Pricing validation)
 */

// Author: Puran
// Impact: Zod schemas for the four product types + add-on groups +
//         variants
// Reason: §4.6 non-negotiable input validation. Centralised in one
//         file so the API contract stays in lock-step with the
//         frontend types and the Prisma JSONB column shapes.

import { z } from "zod";
import { ProductType } from "@/generated/prisma/enums";

// ── Money primitives ────────────────────────────────────────────────

/**
 * Whole-dollar Int — used for `basePrice`, `minPrice`, tier prices,
 * variant prices, and add-on option prices. Mirrors the existing
 * `Product.basePrice` Int column. The eventual app-wide cents
 * migration flips ALL of these together; until then we stay
 * consistent at whole dollars.
 */
const wholeDollars = (label: string) =>
  z
    .number()
    .int(`${label} must be a whole-dollar amount`)
    .min(0, `${label} cannot be negative`)
    .max(10_000_000, `${label} is too large`);

/**
 * Cents-denominated Int — used for `ratePerSqmCents` and
 * `overheadRateCents` so fractional rates like "$5.50/sqm" can be
 * represented losslessly without dragging the rest of the app to
 * cents in V1.
 *
 * Form input "5.50" → state stores 550 → API receives 550 → DB
 * stores 550. Display: 550 / 100 formatted with 2 decimals.
 *
 * Naming convention: every cents field MUST end in `Cents` so the
 * next dev (or future me) can't mistake it for whole dollars at a
 * glance.
 */
const ratePerSqmCents = z
  .number()
  .int("Rate must be a whole number of cents")
  .min(0, "Rate cannot be negative")
  .max(1_000_000, "Rate is too large"); // $10,000/sqm cap — sanity bound

// ── Dimension-based pricing config ──────────────────────────────────

/**
 * Pricing rules for a DIMENSION_BASED product. Stored as JSONB on
 * `Product.pricingConfig`. The three pricing methods (per_sqm,
 * flat_tier, base_plus_sqm) are validated by a single schema with a
 * superRefine that enforces method-specific required fields.
 *
 * Why one schema instead of three discriminated unions: the
 * `pricingMethod` enum already lives inside the JSON, but it's a
 * choice the user makes inside the dimension-based form. Keeping it
 * as a flat schema (instead of nesting another discriminator)
 * matches how the form actually edits the values — the user can
 * switch methods without losing labels / min/max / step / defaults.
 *
 * The shape is intentionally permissive: optional fields for every
 * method, then a superRefine that requires the right ones based on
 * `pricingMethod`. Same pattern as the createProductSchema's
 * categoryId-or-category guard.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Pricing validation)
 */
// BACKLOG NOTE: all three methods are API-ready (validated here +
// computed by `computeDimensionPrice` in src/lib/products/pricing.ts)
// but only `per_sqm` has form UI in V1. The Configuration tab
// dropdown exposes the other two with "UI coming soon" labels;
// when the tier-table editor and the base+overhead input clusters
// land, no API or schema work is needed — they're ready for the
// frontend to start sending the new fields.
const pricingMethodEnum = z.enum(["per_sqm", "flat_tier", "base_plus_sqm"]);

const pricingTierSchema = z
  .object({
    areaFrom: z
      .number()
      .min(0, "Area from cannot be negative")
      .max(100_000, "Area is too large"),
    areaTo: z
      .number()
      .min(0, "Area to cannot be negative")
      .max(100_000, "Area is too large"),
    price: wholeDollars("Tier price"),
  })
  .superRefine((data, ctx) => {
    if (data.areaFrom > data.areaTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["areaTo"],
        message: "Area to must be ≥ area from",
      });
    }
  });

export const dimensionBasedConfigSchema = z
  .object({
    // Dimension input labels — shown to sales team in the configurator
    dim1Label: z
      .string()
      .trim()
      .min(1, "Dimension 1 label is required")
      .max(40, "Label must be 40 characters or less"),
    dim2Label: z
      .string()
      .trim()
      .max(40, "Label must be 40 characters or less")
      .nullable(),
    // Range bounds — apply to BOTH dimensions when dim2Label is set
    dimMin: z
      .number()
      .min(0, "Min value cannot be negative")
      .max(1000, "Min value is too large"),
    dimMax: z
      .number()
      .min(0, "Max value cannot be negative")
      .max(1000, "Max value is too large"),
    dimStep: z
      .number()
      .min(0.01, "Step size must be at least 0.01")
      .max(100, "Step size is too large"),
    dimDefault1: z
      .number()
      .min(0, "Default cannot be negative")
      .max(1000, "Default is too large"),
    dimDefault2: z
      .number()
      .min(0, "Default cannot be negative")
      .max(1000, "Default is too large")
      .nullable(),
    pricingMethod: pricingMethodEnum,
    // per_sqm fields — required when pricingMethod === 'per_sqm'
    ratePerSqmCents: ratePerSqmCents.optional(),
    minArea: z
      .number()
      .min(0, "Minimum area cannot be negative")
      .max(100_000, "Minimum area is too large")
      .optional(),
    minPrice: wholeDollars("Minimum price").optional(),
    // base_plus_sqm fields — required when pricingMethod === 'base_plus_sqm'
    basePrice: wholeDollars("Base price").optional(),
    overheadRateCents: ratePerSqmCents.optional(),
    // flat_tier fields — required when pricingMethod === 'flat_tier'
    pricingTiers: z
      .array(pricingTierSchema)
      .min(1, "At least one tier is required")
      .max(20, "A product can have at most 20 pricing tiers")
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Author: Puran
    // Impact: per-method required-field guards + cross-field invariants
    // Reason: the schema is flat so the form can carry partial state
    //         while the user is editing, but at submit time we enforce
    //         the right fields are present for the chosen method. The
    //         superRefine path produces precise error keys the form
    //         can pin to specific inputs.

    // dimMin <= dimMax invariant — applies to all methods
    if (data.dimMin > data.dimMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimMax"],
        message: "Max value must be ≥ min value",
      });
    }

    // Defaults must sit inside [dimMin, dimMax]
    if (data.dimDefault1 < data.dimMin || data.dimDefault1 > data.dimMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimDefault1"],
        message: "Default must be between min and max",
      });
    }
    if (
      data.dimDefault2 !== null &&
      (data.dimDefault2 < data.dimMin || data.dimDefault2 > data.dimMax)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimDefault2"],
        message: "Default must be between min and max",
      });
    }

    // Method-specific required fields
    switch (data.pricingMethod) {
      case "per_sqm":
        if (data.ratePerSqmCents === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ratePerSqmCents"],
            message: "Rate per sqm is required for the per_sqm method",
          });
        }
        // minArea + minPrice are optional; they default to 0 in the math
        break;
      case "base_plus_sqm":
        if (data.basePrice === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["basePrice"],
            message: "Base price is required for the base_plus_sqm method",
          });
        }
        if (data.overheadRateCents === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["overheadRateCents"],
            message: "Overhead rate is required for the base_plus_sqm method",
          });
        }
        break;
      case "flat_tier":
        if (!data.pricingTiers || data.pricingTiers.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["pricingTiers"],
            message: "At least one pricing tier is required for the flat_tier method",
          });
        }
        break;
    }
  });

// ── pricingConfigSchemaForType factory ───────────────────────────────

/**
 * Returns the right Zod schema for `pricingConfig` given the row's
 * `productType`. STANDARD / SIZE_VARIANT / QUANTITY_ADDONS products
 * have NO pricing config — null is the expected value (or an empty
 * object for backward-compat).
 *
 * Caveat 1 from the sign-off: the row's `productType` is the only
 * discriminator. The JSON does NOT carry its own type field. This
 * factory is the single place that maps row type → JSON shape.
 *
 * Usage in route handlers:
 * ```ts
 * const productType = parsed.data.productType;
 * const pricingConfig = pricingConfigSchemaForType(productType)
 *   .parse(parsed.data.pricingConfig);
 * ```
 *
 * @param type - The Product row's productType
 * @returns Zod schema that validates the pricingConfig JSON for that type
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Pricing validation)
 */
export function pricingConfigSchemaForType(type: ProductType) {
  switch (type) {
    case ProductType.DIMENSION_BASED:
      return dimensionBasedConfigSchema;
    case ProductType.STANDARD:
    case ProductType.SIZE_VARIANT:
    case ProductType.QUANTITY_ADDONS:
      // No pricing config for these types — accept null or undefined
      // (Prisma stores both as NULL). An empty object is also accepted
      // so a form that resets the field to {} doesn't trip a 400.
      return z
        .union([z.null(), z.undefined(), z.object({}).strict()])
        .transform(() => null);
  }
}

// ── Add-on groups ────────────────────────────────────────────────────

/**
 * Pricing unit for an add-on option. Drives how the quote builder
 * computes the line-item total at quote time:
 *
 * - flat     : option.price as-is, regardless of dimensions/quantity
 * - per_unit : option.price × user-entered quantity
 * - per_sqm  : option.price × area derived from parent dimensions
 * - per_bay  : option.price × (parent width / 3m), rounded
 *
 * `per_sqm` and `per_bay` only make sense on add-ons attached to a
 * DIMENSION_BASED product — the quote builder will fall back to
 * "enter qty manually" when used on other product types.
 */
const addonPricingUnitEnum = z.enum(["flat", "per_unit", "per_sqm", "per_bay"]);

/**
 * Selection mode for an add-on group. Controls how many options the
 * sales team can pick from this group in the quote builder:
 *
 * - any              : zero, one, or many options
 * - single           : at most one option, or none
 * - required_single  : exactly one option must be picked
 */
const addonSelectionTypeEnum = z.enum(["any", "single", "required_single"]);

/**
 * Single option inside an add-on group. The `id` is a stable
 * client-generated string (cuid is fine but not enforced) so the
 * quote builder can carry it on the line-item `source.option_id`.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Pricing validation)
 */
export const addonOptionSchema = z.object({
  id: z.string().min(1, "Option id is required").max(40),
  label: z
    .string()
    .trim()
    .min(1, "Option label is required")
    .max(80, "Option label must be 80 characters or less"),
  description: z
    .string()
    .trim()
    .max(200, "Description must be 200 characters or less")
    .nullable()
    .optional(),
  price: wholeDollars("Option price"),
  pricingUnit: addonPricingUnitEnum,
  sortOrder: z
    .number()
    .int("Sort order must be a whole number")
    .min(0)
    .max(1000)
    .optional(),
  active: z.boolean().optional(),
});

/**
 * Single add-on group on a product. Each group is one section in
 * the quote builder configurator (e.g. "Lighting", "Sidewalls").
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Pricing validation)
 */
export const addonGroupSchema = z.object({
  id: z.string().min(1, "Group id is required").max(40),
  label: z
    .string()
    .trim()
    .min(1, "Group label is required")
    .max(80, "Group label must be 80 characters or less"),
  selectionType: addonSelectionTypeEnum,
  customerVisible: z.boolean(),
  sortOrder: z
    .number()
    .int("Sort order must be a whole number")
    .min(0)
    .max(1000)
    .optional(),
  options: z
    .array(addonOptionSchema)
    .max(50, "A group can have at most 50 options"),
});

/**
 * Full add-on groups array on a product. Validated as the
 * `Product.addonGroups` JSONB column on every save. Empty array is
 * the default state — products without add-ons just store `[]`.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Pricing validation)
 */
export const addonGroupsSchema = z
  .array(addonGroupSchema)
  .max(20, "A product can have at most 20 add-on groups");

// ── Product variants (SIZE_VARIANT products) ─────────────────────────

/**
 * Body shape for POST /api/orgs/current/products/[id]/variants.
 *
 * One quantity per variant — `priceDay` / `priceHalfday` /
 * `priceOvernight` are RATE variants for the same physical
 * inventory pool, NOT separate stock counts. This matches the
 * Q3 sign-off and §3 of the spec.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Pricing validation)
 */
export const createVariantSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Variant label is required")
    .max(80, "Label must be 80 characters or less"),
  description: z
    .string()
    .trim()
    .max(200, "Description must be 200 characters or less")
    .nullable()
    .optional(),
  priceDay: wholeDollars("Day rate"),
  priceHalfday: wholeDollars("Half-day rate").nullable().optional(),
  priceOvernight: wholeDollars("Overnight rate").nullable().optional(),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative")
    .max(10_000, "Quantity is too large"),
  skuSuffix: z
    .string()
    .trim()
    .max(20, "SKU suffix must be 20 characters or less")
    .nullable()
    .optional(),
  sortOrder: z
    .number()
    .int("Sort order must be a whole number")
    .min(0)
    .max(1000)
    .optional(),
  active: z.boolean().optional(),
});

/**
 * Partial schema for PATCH — every field optional, same per-field
 * validation as create.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Pricing validation)
 */
export const updateVariantSchema = createVariantSchema.partial();

// ── Inferred TypeScript types ────────────────────────────────────────

export type DimensionBasedConfig = z.infer<typeof dimensionBasedConfigSchema>;
export type PricingTier = z.infer<typeof pricingTierSchema>;
export type AddonOption = z.infer<typeof addonOptionSchema>;
export type AddonGroup = z.infer<typeof addonGroupSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
