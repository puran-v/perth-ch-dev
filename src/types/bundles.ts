/**
 * TypeScript types for the Bundles & Packages feature (Module A step 5).
 *
 * These mirror the Prisma Bundle / BundleItem models and the shapes
 * returned by the /api/orgs/current/bundles endpoints.
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (types)
 */

// Author: samir
// Impact: shared types consumed by hooks, API routes, and the bundles page
// Reason: single source of truth for bundle data shapes across the stack

/** Bundle type — controls whether items can be modified on a quote. */
export type BundleType = "FLEXIBLE" | "LOCKED";

/** Pricing method — determines which pricingConfig shape applies. */
export type BundlePricingMethod = "HOURLY" | "TIERED" | "DAILY" | "CUSTOM";

/** Custom tier row used when pricing method is CUSTOM. */
export interface CustomTier {
  tierType: string;
  hours: number;
  price: number;
}

/** Tiered pricing config shape. */
export interface TieredPricingConfig {
  basePrice: number;
  includedHours: number;
  perExtraHourRate: number;
  maxHireHours: number;
  overnightRate?: number;
  publicHolidayRate?: number;
}

/** Hourly pricing config shape. */
export interface HourlyPricingConfig {
  ratePerHour: number;
  minimumHireHours: number;
}

/** Daily pricing config shape. */
export interface DailyPricingConfig {
  fullDayRate: number;
  halfDayRate: number;
  dailyOvernightRate: number;
}

/** Custom pricing config shape. */
export interface CustomPricingConfig {
  tiers: CustomTier[];
}

/** Union of all pricing config shapes. */
export type BundlePricingConfig =
  | TieredPricingConfig
  | HourlyPricingConfig
  | DailyPricingConfig
  | CustomPricingConfig;

/** Product summary included in a bundle item (joined from Product table). */
export interface BundleItemProduct {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    basePrice: number;
  };
}

/** Row shape returned by the bundles list/detail API. */
export interface BundleRow {
  id: string;
  orgId: string;
  name: string;
  type: BundleType;
  pricingMethod: BundlePricingMethod;
  pricingConfig: BundlePricingConfig | null;
  bundlePrice: number;
  savings: number;
  suggestedEventTypes: string | null;
  internalNotes: string | null;
  items: BundleItemProduct[];
  createdAt: string;
  updatedAt: string;
}

/** Input shape for creating a new bundle. */
export interface CreateBundleInput {
  name: string;
  type?: BundleType;
  pricingMethod?: BundlePricingMethod;
  pricingConfig?: BundlePricingConfig;
  bundlePrice?: number;
  savings?: number;
  suggestedEventTypes?: string;
  internalNotes?: string;
  /** Product IDs to include in the bundle. */
  productIds: string[];
}

/** Input shape for updating an existing bundle. */
export interface UpdateBundleInput {
  name?: string;
  type?: BundleType;
  pricingMethod?: BundlePricingMethod;
  pricingConfig?: BundlePricingConfig;
  bundlePrice?: number;
  savings?: number;
  suggestedEventTypes?: string;
  internalNotes?: string;
  /** Replace bundle items with this list of product IDs. */
  productIds?: string[];
}
