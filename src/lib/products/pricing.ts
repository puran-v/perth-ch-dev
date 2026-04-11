/**
 * Pure pricing math for configurable products (Module A — Products).
 *
 * SINGLE SOURCE OF TRUTH for the formulas in §4 of the Configurable
 * Product Pricing developer spec. Both the admin form's live preview
 * (Configuration tab → Pricing preview cells) and the future quote
 * builder's configurator modal MUST import from this file. No
 * parallel implementations — that's how the admin price and the
 * sales price end up disagreeing.
 *
 * Pure functions only. No React, no Prisma, no fetch, no side
 * effects. Same code runs server-side (when the quote builder posts
 * a configuration) and client-side (when the admin form previews).
 *
 * ── Money units ──────────────────────────────────────────────────────
 * - All `*Cents` fields are Int cents (e.g. `ratePerSqmCents = 550`
 *   means $5.50 per sqm).
 * - All `*price` / `*Price` fields are Int whole dollars (matches
 *   the existing `Product.basePrice` column).
 * - Function return values are always Int whole dollars — the math
 *   rounds at the cents → dollars boundary so the quote builder
 *   never has to deal with fractional cents.
 *
 * ── Rounding policy ──────────────────────────────────────────────────
 * Half-up via `Math.round()` at the cents → dollars boundary. Anywhere
 * else (intermediate sums, area math) is exact integer arithmetic.
 *
 * Example: 9×9 marquee at $5.50/sqm
 *   area = 81 sqm
 *   billable = max(minArea, area) = 81 sqm
 *   computedCents = 81 × 550 = 44550
 *   computedDollars = round(44550 / 100) = round(445.5) = 446
 *   price = max(minPrice, 446)
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (pricing math)
 */

// Author: Puran
// Impact: pure pricing helpers — same file imported by admin preview
//         and (eventually) the quote builder configurator modal
// Reason: §4.2 + §6 of the Configurable Product Pricing spec.
//         Putting the math in one place is the only way to keep
//         the admin price and the quoted price in sync forever.

import type { DimensionBasedConfig } from "@/server/lib/validation/pricing";

// ── Internal helpers ────────────────────────────────────────────────

/**
 * Rounds a cents amount to whole dollars, half-up. Internal helper —
 * the only place in the file that crosses the cents/dollars boundary
 * so the rounding rule lives in exactly one spot.
 *
 * @param cents - Cents amount (can be fractional during the multiply)
 * @returns Whole-dollar Int
 */
function centsToDollarsRounded(cents: number): number {
  return Math.round(cents / 100);
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Computes the price for a DIMENSION_BASED product given a width
 * and length selection. Returns the final whole-dollar price the
 * sales team would see in the quote builder.
 *
 * Three pricing methods are supported, all from §4 of the spec:
 *   1. per_sqm        : MAX(minPrice, billable_area × rate_per_sqm)
 *   2. flat_tier      : lookup table area_from..area_to → price
 *   3. base_plus_sqm  : base_price + MAX(0, area − min_area) × overhead
 *
 * Edge cases handled:
 *   - Missing optional fields (minArea / minPrice / pricingTiers)
 *     default to 0 / 0 / [] so a partially-filled config still
 *     returns a deterministic number instead of NaN.
 *   - flat_tier with no matching tier returns the floor (minPrice
 *     ?? 0) so the form previews don't render `$NaN` while the user
 *     is mid-edit.
 *
 * @param config - DimensionBasedConfig (validated upstream by Zod)
 * @param width - Selected width in metres
 * @param length - Selected length in metres
 * @returns Final price in whole dollars
 *
 * @example
 * computeDimensionPrice(
 *   {
 *     pricingMethod: "per_sqm",
 *     ratePerSqmCents: 800,
 *     minArea: 9,
 *     minPrice: 200,
 *     // ... other fields
 *   },
 *   6, 6,
 * )
 * // → 288 (36 sqm × $8/sqm = $288, above the $200 floor)
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (pricing math)
 */
export function computeDimensionPrice(
  config: DimensionBasedConfig,
  width: number,
  length: number,
): number {
  const area = width * length;

  switch (config.pricingMethod) {
    case "per_sqm": {
      // billable_area = MAX(min_area, area)
      const billableArea = Math.max(config.minArea ?? 0, area);
      // computed = billable × rate (in cents) → round to dollars
      const computedCents = billableArea * (config.ratePerSqmCents ?? 0);
      const computedDollars = centsToDollarsRounded(computedCents);
      // price = MAX(min_price, computed)
      return Math.max(config.minPrice ?? 0, computedDollars);
    }

    case "flat_tier": {
      // Find the first tier that brackets `area` inclusively. The
      // schema enforces areaFrom <= areaTo per tier, but we don't
      // assume the array is sorted — the form may reorder mid-edit.
      const tier = (config.pricingTiers ?? []).find(
        (t) => area >= t.areaFrom && area <= t.areaTo,
      );
      // No matching tier → fall through to the floor price (or 0
      // if no floor is set). This keeps live previews honest while
      // the admin is still defining tier ranges.
      return tier?.price ?? config.minPrice ?? 0;
    }

    case "base_plus_sqm": {
      // base_price covers the minimum area; everything above is
      // charged at overhead_rate per extra sqm.
      const basePrice = config.basePrice ?? 0;
      const overheadArea = Math.max(0, area - (config.minArea ?? 0));
      const overheadCents = overheadArea * (config.overheadRateCents ?? 0);
      const overheadDollars = centsToDollarsRounded(overheadCents);
      return basePrice + overheadDollars;
    }
  }
}

// ── Live preview helper ────────────────────────────────────────────

/**
 * One cell in the Pricing preview grid shown on the admin
 * Configuration tab. The form picks a handful of representative
 * dimension pairs and feeds them through `computeDimensionPrice` to
 * give the user a "what would the sales team see?" sanity check.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (pricing math)
 */
export interface DimensionPreviewCell {
  /** Stable React key — composed from the dimension pair */
  key: string;
  /** Display label, e.g. "6×9m" */
  label: string;
  /** Final price, formatted with `$` prefix */
  price: string;
  /** Total area, formatted as "Nm²" */
  area: string;
}

/**
 * Hardcoded dimension pairs used by the admin Configuration tab to
 * render its 8-cell preview grid. Mirrors the V1 form spec — when
 * V2 lets the user pick custom preview pairs (or the form generates
 * them from min/max range), this constant goes away.
 */
export const DEFAULT_PREVIEW_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [3, 3],
  [3, 6],
  [6, 6],
  [6, 9],
  [6, 12],
  [9, 9],
  [9, 12],
  [12, 12],
];

/**
 * Computes the live preview grid shown above the Pricing preview
 * heading on the Configuration tab. Pure function — the form calls
 * this inside a `useMemo` over the relevant config fields and the
 * cells re-render the moment the user edits the rate.
 *
 * @param config - The current dimension-based pricing config
 * @param pairs - Optional custom preview pairs (defaults to
 *                `DEFAULT_PREVIEW_PAIRS`)
 * @returns Array of `DimensionPreviewCell` ready to render
 *
 * @example
 * const cells = computeDimensionPreview(config);
 * // [
 * //   { key: "3x3", label: "3×3m", price: "$200", area: "9m²" },
 * //   { key: "3x6", label: "3×6m", price: "$200", area: "18m²" },
 * //   ...
 * // ]
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (pricing math)
 */
export function computeDimensionPreview(
  config: DimensionBasedConfig,
  pairs: ReadonlyArray<readonly [number, number]> = DEFAULT_PREVIEW_PAIRS,
): DimensionPreviewCell[] {
  return pairs.map(([d1, d2]) => {
    const area = d1 * d2;
    const price = computeDimensionPrice(config, d1, d2);
    return {
      key: `${d1}x${d2}`,
      label: `${d1}×${d2}m`,
      price: `$${price}`,
      area: `${area}m²`,
    };
  });
}

// ── Cents helpers (form layer) ─────────────────────────────────────

/**
 * Converts a user-typed dollar string (e.g. "5.50") into Int cents
 * (550). Used by the Configuration tab's rate inputs to bridge the
 * "humans type dollars, storage stores cents" gap.
 *
 * Returns `null` for empty input so the caller can store null in
 * partial config state without conflating "no value" with "$0".
 *
 * Strips `$` and whitespace, accepts up to 2 decimal places. Extra
 * decimals are truncated (not rounded) so a user typing "5.555" sees
 * 555 cents = $5.55, not 556 cents.
 *
 * @param input - Raw user input string
 * @returns Cents as Int, or null when input is empty/invalid
 *
 * @example
 * dollarStringToCents("5.50") // → 550
 * dollarStringToCents("$8")   // → 800
 * dollarStringToCents("")     // → null
 * dollarStringToCents("abc")  // → null
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (pricing math)
 */
export function dollarStringToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  // Allow leading sign just in case the user pastes a negative —
  // negative rates are nonsense but we let Zod reject them upstream.
  if (!/^-?\d+(\.\d{0,2})?\d*$/.test(cleaned)) return null;
  const dollars = parseFloat(cleaned);
  if (!Number.isFinite(dollars)) return null;
  // Multiply then round to handle JavaScript float weirdness
  // (e.g. 5.5 × 100 = 549.9999... in some FP edge cases).
  return Math.round(dollars * 100);
}

/**
 * Inverse of `dollarStringToCents` — formats Int cents as a
 * user-readable dollar string with 2 decimal places.
 *
 * @param cents - Int cents (e.g. 550)
 * @returns Formatted string (e.g. "5.50") or empty string for null
 *
 * @example
 * centsToDollarString(550)  // → "5.50"
 * centsToDollarString(800)  // → "8.00"
 * centsToDollarString(null) // → ""
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (pricing math)
 */
export function centsToDollarString(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}
