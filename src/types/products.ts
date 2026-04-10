/**
 * Type definitions for Module A — Products (hire catalogue).
 *
 * Currently only the frontend list view is implemented. The Product
 * model + /api/orgs/current/products endpoints will land in a follow-up
 * PR — when they do, the same types should be reused on the wire so
 * the page and the backend can never drift on shape.
 *
 * @author Puran
 * @created 2026-04-07
 * @module Module A - Products
 */

// Author: Puran
// Impact: new types file backing the products list page
// Reason: keep the eventual API + UI on a single source of truth from
//         day one so we don't end up with two parallel Product shapes

/**
 * Lifecycle state of a product in the catalogue.
 *
 * - ACTIVE       — bookable, has a price, fully configured
 * - MAINTENANCE  — temporarily unavailable (under repair, out of season)
 * - NO_PRICE     — visible but missing a base price; quote builder will
 *                  refuse to add it until pricing is set
 * - INACTIVE     — soft-archived, hidden from the catalogue picker but
 *                  retained for historical bookings
 */
export type ProductStatus = "ACTIVE" | "MAINTENANCE" | "NO_PRICE" | "INACTIVE";

/**
 * Pricing model for a configurable product. Mirrors the
 * `ProductType` Postgres enum + the Zod `productTypeSchema` —
 * single source of truth for the discriminator across DB, API,
 * and UI.
 *
 * - STANDARD        : single fixed `basePrice`, no configuration
 * - DIMENSION_BASED : priced by width × length via `pricingConfig`
 * - SIZE_VARIANT    : per-variant pricing + per-variant inventory
 *                     in `variants[]`
 * - QUANTITY_ADDONS : fixed `basePrice` + selectable add-on groups
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (pricing models)
 */
export type ProductType =
  | "STANDARD"
  | "DIMENSION_BASED"
  | "SIZE_VARIANT"
  | "QUANTITY_ADDONS";

/**
 * Pricing method inside `pricingConfig` for a DIMENSION_BASED
 * product. Mirrors the spec's three formulas (§4 of the spec).
 */
export type PricingMethod = "per_sqm" | "flat_tier" | "base_plus_sqm";

/**
 * One row in the flat-tier lookup table. Used when
 * `pricingMethod === "flat_tier"`.
 */
export interface PricingTier {
  areaFrom: number;
  areaTo: number;
  /** Whole-dollar Int */
  price: number;
}

/**
 * `pricingConfig` shape for a DIMENSION_BASED product. Stored as
 * JSONB on the product row, validated by `dimensionBasedConfigSchema`
 * server-side. Three pricing methods share the same flat shape so
 * the form can carry partial state while the user is editing.
 *
 * `*Cents` fields hold rates in Int cents so fractional rates like
 * "$5.50/sqm" survive without dragging the rest of the app to a
 * cents migration. The naming convention is enforced — every cents
 * field MUST end in `Cents`.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (pricing models)
 */
export interface DimensionBasedConfig {
  dim1Label: string;
  dim2Label: string | null;
  dimMin: number;
  dimMax: number;
  dimStep: number;
  dimDefault1: number;
  dimDefault2: number | null;
  pricingMethod: PricingMethod;
  // per_sqm fields
  ratePerSqmCents?: number;
  minArea?: number;
  minPrice?: number;
  // base_plus_sqm fields
  basePrice?: number;
  overheadRateCents?: number;
  // flat_tier fields
  pricingTiers?: PricingTier[];
}

/**
 * Pricing unit for an add-on option. Drives quote-builder math when
 * the sales team picks the option.
 */
export type AddonPricingUnit = "flat" | "per_unit" | "per_sqm" | "per_bay";

/** Selection mode for an add-on group. */
export type AddonSelectionType = "any" | "single" | "required_single";

/**
 * Single option inside an add-on group. The `id` is a stable
 * client-generated string (cuid recommended) so the quote builder
 * can carry it on the line item's `source.option_id`.
 */
export interface AddonOption {
  id: string;
  label: string;
  description?: string | null;
  /** Whole-dollar Int */
  price: number;
  pricingUnit: AddonPricingUnit;
  sortOrder?: number;
  active?: boolean;
}

/**
 * Single add-on group on a product — one section of the quote
 * builder configurator (e.g. "Lighting", "Sidewalls"). Stored as
 * JSONB inside `Product.addonGroups`.
 */
export interface AddonGroup {
  id: string;
  label: string;
  selectionType: AddonSelectionType;
  customerVisible: boolean;
  sortOrder?: number;
  options: AddonOption[];
}

/**
 * One row from the `product_variants` table. Carries its own
 * pricing AND its own inventory count — this is the "important
 * distinction" called out in §3 of the spec. A SIZE_VARIANT
 * product has multiple of these; every other product type has
 * none.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (variants)
 */
export interface ProductVariant {
  id: string;
  orgId: string;
  productId: string;
  label: string;
  description: string | null;
  /** Whole-dollar Int day rate */
  priceDay: number;
  priceHalfday: number | null;
  priceOvernight: number | null;
  /** PER-VARIANT inventory count, NOT the parent product's qty */
  quantity: number;
  skuSuffix: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product row as the catalogue page expects it.
 *
 * Money is stored as a whole-dollar number for V1 (no cents). When the
 * backend lands we'll switch this to an integer cents column to avoid
 * floating-point drift, mirrored here as `basePriceCents`.
 */
export interface Product {
  id: string;
  /** Org-scoped SKU shown beneath the name */
  sku: string;
  name: string;
  /** Display category — e.g. "Inflatable", "Ride", "Game" */
  category: string;
  /** Number of identical units the org owns */
  quantity: number;
  /** Daily hire price in whole dollars */
  basePrice: number;
  /** Setup time in minutes (used by warehouse + scheduling later) */
  setupMinutes: number;
  /** Pack-down time in minutes */
  packdownMinutes: number;
  status: ProductStatus;
}

/**
 * Aggregate counts shown in the stats row above the catalogue.
 * Derived client-side from the product list for V1; backend can supply
 * these directly once the list grows past one page.
 */
export interface ProductStats {
  total: number;
  categories: number;
  needsPricing: number;
  inactive: number;
}

/**
 * Wire shape returned by the Products API.
 *
 * Mirrors the columns the form actually consumes plus the audit
 * timestamps the API exposes. Anything Prisma-only (createdBy,
 * updatedBy, deletedAt) is intentionally absent — the form has no
 * use for it and surfacing fewer fields keeps the type honest.
 *
 * `images` and `tags` come back as plain string arrays — the storage
 * detail (base64 data URL today, https URL tomorrow) is opaque to
 * the consumer.
 *
 * Replaces the `ProductDetail` mock type from `src/lib/mock-products.ts`.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */
/**
 * Wire shape returned by the Categories API. Mirrors the active
 * columns of `ProductCategory` — the slug is exposed too so the
 * combobox can do client-side dedupe checks before round-tripping.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */
export interface ProductCategory {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lightweight category reference embedded on `ProductRow.categoryRef`.
 * The list and detail GET endpoints `include` this so the form can
 * hydrate the combobox label without an extra round-trip.
 */
export interface ProductCategoryRef {
  id: string;
  name: string;
  slug: string;
}

/**
 * Body shape for POST /api/orgs/current/categories.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */
export interface CreateCategoryInput {
  name: string;
  sortOrder?: number;
}

export interface ProductRow {
  id: string;
  orgId: string;
  name: string;
  sku: string;
  /**
   * Legacy free-text category column. Still populated by the dual-
   * write rollout so any consumer that hasn't migrated yet keeps
   * working. New code should prefer `categoryRef.name`.
   *
   * @deprecated Read via `categoryRef` instead. This column will be
   * dropped in the follow-up PR once every consumer has migrated.
   */
  category: string;
  /**
   * Foreign key into ProductCategory. Nullable for V1 because rows
   * created before the categories migration only had the legacy
   * string column. Once the legacy column is dropped this becomes
   * non-null.
   */
  categoryId: string | null;
  /**
   * Resolved category row. Returned by GET endpoints via Prisma
   * `include`. Null when `categoryId` is null (legacy product not
   * yet linked through the new combobox).
   */
  categoryRef: ProductCategoryRef | null;
  subcategory: string | null;
  description: string | null;
  /**
   * Legacy boolean — kept during the dual-write rollout. Read
   * `productType` instead. This field is dropped in the follow-up
   * PR after the form has been on `productType` for a soak cycle.
   *
   * @deprecated Read `productType` instead.
   */
  configurable: boolean;
  /**
   * Pricing model discriminator. Drives the Configuration tab in
   * the editor and (eventually) the quote builder configurator
   * modal. The single source of truth for which pricing engine
   * applies to this product.
   */
  productType: ProductType;
  /**
   * Pricing rules for the model. Shape depends on `productType`:
   * `DimensionBasedConfig` for DIMENSION_BASED, `null` for the
   * other three types. Validated server-side via the
   * `pricingConfigSchemaForType(productType)` factory.
   */
  pricingConfig: DimensionBasedConfig | null;
  /**
   * Add-on groups attachable to ANY product type. Empty array
   * is the default for products without add-ons.
   */
  addonGroups: AddonGroup[];
  /**
   * Variants list — populated only for SIZE_VARIANT products.
   * Empty array for every other type. The API includes this
   * relation on every GET so the editor hydrates without an
   * extra round-trip.
   */
  variants: ProductVariant[];
  status: ProductStatus;
  quantity: number;
  basePrice: number;
  setupMinutes: number;
  packdownMinutes: number;
  // Operational tab
  staffSetup: number;
  staffOperate: number;
  lengthM: number | null;
  widthM: number | null;
  heightM: number | null;
  weightKg: number | null;
  truckSpaceUnits: number | null;
  handlingFlags: string[];
  // Warehouse tab
  warehouseZone: string | null;
  warehouseBayShelf: string | null;
  warehouseLocationNotes: string | null;
  requiresCleaning: boolean;
  requiresCharging: boolean;
  requiresConsumableCheck: boolean;
  requiresInspection: boolean;
  customPostJobRules: string[];
  // Notes & Rules tab
  salesNotes: string | null;
  warehouseNotes: string | null;
  aiRules: string | null;
  // Configuration tab — notes shown to sales in the configurator
  configNotes: string | null;
  images: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Body shape for POST /api/orgs/current/products.
 * Optional fields default server-side; required fields mirror the
 * Zod `createProductSchema`.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */
export interface CreateProductInput {
  name: string;
  sku: string;
  /**
   * Preferred field — the new combobox sends this. Server resolves
   * the row, validates it belongs to the caller's org, and dual-
   * writes the legacy `category` string from the resolved name.
   */
  categoryId?: string;
  /**
   * Legacy free-text category. Still accepted for any caller on the
   * old contract. The server enforces "at least one of categoryId /
   * category" via Zod superRefine on create. New form code SHOULD
   * NOT send this field — it's wired up so the dual-write phase
   * doesn't break old callers.
   *
   * @deprecated Send `categoryId` instead.
   */
  category?: string;
  subcategory?: string | null;
  description?: string | null;
  /**
   * Legacy boolean — kept during the dual-write rollout. New form
   * code should send `productType` instead. Removed in the
   * follow-up PR.
   *
   * @deprecated Send `productType` instead.
   */
  configurable?: boolean;
  /** Pricing model discriminator (single source of truth). */
  productType?: ProductType;
  /**
   * Pricing rules JSON. Shape depends on `productType` — the
   * server validates via `pricingConfigSchemaForType(productType)`
   * so the type sent in the row is the only place that matters.
   */
  pricingConfig?: DimensionBasedConfig | null;
  /** Add-on groups (any product type). */
  addonGroups?: AddonGroup[];
  status?: ProductStatus;
  quantity?: number;
  basePrice?: number;
  setupMinutes?: number;
  packdownMinutes?: number;
  // Operational tab
  staffSetup?: number;
  staffOperate?: number;
  lengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
  weightKg?: number | null;
  truckSpaceUnits?: number | null;
  handlingFlags?: string[];
  // Warehouse tab
  warehouseZone?: string | null;
  warehouseBayShelf?: string | null;
  warehouseLocationNotes?: string | null;
  requiresCleaning?: boolean;
  requiresCharging?: boolean;
  requiresConsumableCheck?: boolean;
  requiresInspection?: boolean;
  customPostJobRules?: string[];
  // Notes & Rules tab
  salesNotes?: string | null;
  warehouseNotes?: string | null;
  aiRules?: string | null;
  // Configuration tab
  configNotes?: string | null;
  images?: string[];
  tags?: string[];
}

/**
 * Body shape for PATCH /api/orgs/current/products/[id].
 * Every field is optional — the server only updates what's sent.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products
 */
export type UpdateProductInput = Partial<CreateProductInput>;

/**
 * Body shape for POST /api/orgs/current/products/[id]/variants.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (variants)
 */
export interface CreateVariantInput {
  label: string;
  description?: string | null;
  /** Whole-dollar Int day rate (matches `Product.basePrice` units) */
  priceDay: number;
  priceHalfday?: number | null;
  priceOvernight?: number | null;
  quantity: number;
  skuSuffix?: string | null;
  sortOrder?: number;
  active?: boolean;
}

/**
 * Body shape for PATCH /api/orgs/current/products/[id]/variants/[variantId].
 * Every field is optional — the server only updates what's sent.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (variants)
 */
export type UpdateVariantInput = Partial<CreateVariantInput>;
