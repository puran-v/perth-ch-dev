"use client";

/**
 * React Query hooks for the Product Categories API
 * (`/api/orgs/current/categories` + `/[id]`).
 *
 * Mirrors the `useProducts.ts` shape so the products domain has a
 * single, predictable hook style. Every consumer in the app — the
 * combobox, the (future) categories admin page, the products list —
 * goes through these.
 *
 * @example
 * const { data: categories } = useCategories();
 *
 * const create = useCreateCategory();
 * create.mutate({ name: "Inflatable" });
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories hooks)
 */

// Author: Puran
// Impact: typed hooks for category list / create / update / delete
// Reason: every component that needs the org's category list reads
//         from one cache key so creates from anywhere refresh every
//         open consumer (combobox, list page stats, admin page)

import { useApiQuery } from "@/hooks/useApiQuery";
import { useApiMutation } from "@/hooks/useApiMutation";
import type {
  ProductCategory,
  CreateCategoryInput,
} from "@/types/products";

/** Root cache key for everything Categories. */
export const CATEGORIES_QUERY_KEY = ["product-categories"] as const;

/** Cache key for a single category detail. */
export const categoryQueryKey = (id: string) =>
  [...CATEGORIES_QUERY_KEY, id] as const;

/**
 * Fetches the list of active product categories for the caller's org.
 * Uses limit=200 — categories are tiny, the org will never have more
 * than a few dozen, so a single page is fine for V1.
 *
 * Cached aggressively (5 min staleTime) because the list rarely
 * changes mid-session and the combobox needs instant render.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories hooks)
 */
export function useCategories() {
  return useApiQuery<ProductCategory[]>(
    CATEGORIES_QUERY_KEY,
    "/api/orgs/current/categories?limit=200",
    {
      // Categories rarely change mid-session — keep them fresh in
      // cache so the combobox doesn't refetch on every open.
      staleTime: 5 * 60 * 1000,
    }
  );
}

/**
 * Creates a new category. Invalidates the list cache on success so
 * the combobox + list page stats pick up the new row immediately.
 *
 * The server-side resurrection rule means calling create with a
 * previously soft-deleted category name will bring that row back
 * (same id, fresh casing) instead of creating a duplicate.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories hooks)
 */
export function useCreateCategory() {
  return useApiMutation<ProductCategory, CreateCategoryInput>(
    "/api/orgs/current/categories",
    "post",
    { invalidateKeys: [CATEGORIES_QUERY_KEY] }
  );
}

/**
 * Updates a category (rename / reorder / activate-deactivate).
 * Invalidates BOTH the list cache and the specific category's
 * detail cache. Also invalidates the products list because rename
 * triggers the dual-write that updates every product row's
 * legacy category string column.
 *
 * @param id - Category id to update
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories hooks)
 */
export function useUpdateCategory(id: string) {
  return useApiMutation<
    ProductCategory,
    { name?: string; sortOrder?: number; active?: boolean }
  >(`/api/orgs/current/categories/${id}`, "patch", {
    invalidateKeys: [
      CATEGORIES_QUERY_KEY,
      categoryQueryKey(id),
      // Products list reads category names through categoryRef so it
      // needs to refetch when a category gets renamed.
      ["products"],
    ],
  });
}

/**
 * Soft-deletes a category. The server returns 409 CATEGORY_IN_USE
 * if any active product still references the row — the caller
 * should surface that as a toast asking the admin to reassign first.
 *
 * @param id - Category id to delete
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (Categories hooks)
 */
export function useDeleteCategory(id: string) {
  return useApiMutation<{ message: string }, void>(
    `/api/orgs/current/categories/${id}`,
    "del",
    {
      invalidateKeys: [
        CATEGORIES_QUERY_KEY,
        categoryQueryKey(id),
        ["products"],
      ],
    }
  );
}
