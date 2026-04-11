/**
 * Zod validation schemas for the Product Categories API
 * (Module A — Products / Categories).
 *
 * Per PROJECT_RULES §4.6: every API route MUST validate input with Zod
 * before any business logic. This file is the single source of truth for
 * the wire shape of a ProductCategory so the route handlers, the form,
 * and the generated types can never drift.
 *
 * Slug is intentionally NOT accepted from the client — the server
 * derives it from `name.toLowerCase().trim()` so the case-insensitive
 * uniqueness contract holds regardless of what the client sends.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories validation)
 */

// Author: Puran
// Impact: Zod schemas for ProductCategory create / update / list
// Reason: §4.6 non-negotiable input validation; centralised in one
//         file so the API contract stays in sync with the frontend
//         hooks and the Prisma model

import { z } from "zod";

// ── Field schemas ────────────────────────────────────────────────────

/**
 * Display name shown to the user. Trimmed, required, capped at 80 chars
 * to match the analogous `category` length cap on the products schema.
 */
const categoryName = z
  .string()
  .trim()
  .min(1, "Category name is required")
  .max(80, "Category name must be 80 characters or less");

// ── Create / update ──────────────────────────────────────────────────

/**
 * Body shape for POST /api/orgs/current/categories.
 *
 * `slug` is computed server-side from `name`, never accepted from the
 * client — that's the only way to keep the case-insensitive
 * uniqueness contract honest.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories validation)
 */
export const createCategorySchema = z.object({
  name: categoryName,
  /**
   * Optional sort position. Not exposed in V1 (no admin reorder UI yet)
   * but accepted on create so a future bulk-import flow can seed
   * categories with their preferred ordering.
   */
  sortOrder: z
    .number()
    .int("Sort order must be a whole number")
    .min(0, "Sort order cannot be negative")
    .max(10_000, "Sort order is too large")
    .optional(),
});

/**
 * Body shape for PATCH /api/orgs/current/categories/[id]. Every field
 * is optional but each present field is still validated by the same
 * rules as create. `name` rename triggers a fresh case-insensitive
 * dedupe check on the server side.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories validation)
 */
export const updateCategorySchema = z.object({
  name: categoryName.optional(),
  sortOrder: z
    .number()
    .int("Sort order must be a whole number")
    .min(0, "Sort order cannot be negative")
    .max(10_000, "Sort order is too large")
    .optional(),
  active: z.boolean().optional(),
});

// ── Inferred types ───────────────────────────────────────────────────

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ── Slug helper ──────────────────────────────────────────────────────

/**
 * Normalises a category display name into the lowercase trimmed slug
 * used for the (orgId, slug) unique constraint. Single source of
 * truth — the create/update routes call this so the frontend never
 * has to know about the slug column.
 *
 * @param name - Raw display name from the client
 * @returns Lowercase trimmed slug
 *
 * @example
 * categoryNameToSlug("  Inflatable  ") // → "inflatable"
 * categoryNameToSlug("Heavy-Duty Marquees") // → "heavy-duty marquees"
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories validation)
 */
export function categoryNameToSlug(name: string): string {
  return name.trim().toLowerCase();
}
