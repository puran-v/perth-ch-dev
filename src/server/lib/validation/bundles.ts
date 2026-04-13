/**
 * Zod validation schemas for the Bundles & Packages API.
 *
 * Every POST/PATCH to /api/orgs/current/bundles runs through these
 * schemas BEFORE any business logic (PROJECT_RULES §4.6).
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (validation)
 */

// Author: samir
// Impact: input validation for bundle CRUD endpoints
// Reason: §4.6 — Zod validation is non-negotiable for every API route

import { z } from "zod";

// ── Pricing config sub-schemas ──────────────────────────────────────

const tieredPricingSchema = z.object({
  basePrice: z.number().min(0),
  includedHours: z.number().int().min(1),
  perExtraHourRate: z.number().min(0),
  maxHireHours: z.number().int().min(1),
  overnightRate: z.number().min(0).optional(),
  publicHolidayRate: z.number().min(0).optional(),
});

const hourlyPricingSchema = z.object({
  ratePerHour: z.number().min(0),
  minimumHireHours: z.number().int().min(1),
});

const dailyPricingSchema = z.object({
  fullDayRate: z.number().min(0),
  halfDayRate: z.number().min(0),
  dailyOvernightRate: z.number().min(0),
});

const customTierSchema = z.object({
  tierType: z.string().trim().min(1),
  hours: z.number().min(0),
  price: z.number().min(0),
});

const customPricingSchema = z.object({
  tiers: z.array(customTierSchema).min(1, "At least one tier is required"),
});

// ── Bundle type & pricing method enums ──────────────────────────────

const bundleTypeSchema = z.enum(["FLEXIBLE", "LOCKED"]);
const bundlePricingMethodSchema = z.enum(["HOURLY", "TIERED", "DAILY", "CUSTOM"]);

// ── Create bundle ───────────────────────────────────────────────────

export const createBundleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Bundle name is required")
    .max(200, "Bundle name must be 200 characters or fewer"),
  type: bundleTypeSchema.optional().default("FLEXIBLE"),
  pricingMethod: bundlePricingMethodSchema.optional().default("TIERED"),
  pricingConfig: z.unknown().optional(),
  bundlePrice: z.number().int().min(0).optional().default(0),
  savings: z.number().int().min(0).optional().default(0),
  suggestedEventTypes: z.string().trim().max(500).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
  productIds: z
    .array(z.string().min(1))
    .min(1, "At least one product must be included"),
});

// ── Update bundle ───────────────────────────────────────────────────

export const updateBundleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Bundle name is required")
    .max(200, "Bundle name must be 200 characters or fewer")
    .optional(),
  type: bundleTypeSchema.optional(),
  pricingMethod: bundlePricingMethodSchema.optional(),
  pricingConfig: z.unknown().optional(),
  bundlePrice: z.number().int().min(0).optional(),
  savings: z.number().int().min(0).optional(),
  suggestedEventTypes: z.string().trim().max(500).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
  productIds: z
    .array(z.string().min(1))
    .min(1, "At least one product must be included")
    .optional(),
});

// ── List query filter ───────────────────────────────────────────────

export const listBundlesQuerySchema = z.object({
  search: z.string().trim().optional(),
  type: bundleTypeSchema.optional(),
});

// ── Pricing config validation factory ───────────────────────────────

/**
 * Returns the correct Zod schema for the given pricing method.
 * If pricingConfig is null/undefined, returns z.any() so the field
 * is treated as optional (the caller decides whether to require it).
 *
 * @param method - The bundle's pricing method
 * @returns Zod schema matching the pricing method
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (validation)
 */
export function pricingConfigSchemaForMethod(method: string) {
  switch (method) {
    case "TIERED":
      return tieredPricingSchema;
    case "HOURLY":
      return hourlyPricingSchema;
    case "DAILY":
      return dailyPricingSchema;
    case "CUSTOM":
      return customPricingSchema;
    default:
      return z.unknown();
  }
}
