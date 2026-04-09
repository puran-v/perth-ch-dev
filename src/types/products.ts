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
