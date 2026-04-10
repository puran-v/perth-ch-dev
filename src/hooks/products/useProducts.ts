"use client";

/**
 * React Query hooks for the Products API
 * (`/api/orgs/current/products` + `/[id]`).
 *
 * Every consumer in the app — list page, edit page, editor form —
 * goes through these hooks. They centralise:
 *   - the cache key strategy (one constant, used by every mutation)
 *   - the URL strings (no string-typing in components)
 *   - the response shape (`ProductRow` everywhere)
 *
 * Mirrors the `src/hooks/team/useRoles.ts` pattern.
 *
 * @example
 * const { data: products, isLoading } = useProductList();
 * const { data: product } = useProduct(id);
 *
 * const create = useCreateProduct();
 * create.mutate({ name: "Big Blue Castle", sku: "SKU-001", category: "Inflatable" });
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (hooks)
 */

// Author: Puran
// Impact: typed product hooks for list / detail / create / update / delete
// Reason: replaces direct MOCK_PRODUCTS imports + the toast stub in
//         ProductEditorForm with real API round-trips

import { useApiQuery } from "@/hooks/useApiQuery";
import { useApiMutation } from "@/hooks/useApiMutation";
import type {
  ProductRow,
  CreateProductInput,
  UpdateProductInput,
} from "@/types/products";

/** Root cache key for everything Products. */
export const PRODUCTS_QUERY_KEY = ["products"] as const;

/** Cache key for a single product detail. */
export const productQueryKey = (id: string) =>
  [...PRODUCTS_QUERY_KEY, id] as const;

/**
 * Fetches the list of products for the caller's org.
 * Uses limit=100 (the API max) so V1 doesn't need pagination UI —
 * the catalogue page still aggregates stats client-side.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (hooks)
 */
export function useProductList() {
  return useApiQuery<ProductRow[]>(
    PRODUCTS_QUERY_KEY,
    "/api/orgs/current/products?limit=100"
  );
}

/**
 * Fetches a single product by id. Pass `undefined` to disable the
 * query (e.g. while route params are still resolving).
 *
 * @param id - Product id, or undefined to skip the fetch
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (hooks)
 */
export function useProduct(id: string | undefined) {
  return useApiQuery<ProductRow>(
    productQueryKey(id ?? "__none__"),
    `/api/orgs/current/products/${id}`,
    { enabled: Boolean(id) }
  );
}

/**
 * Creates a new product. Invalidates the list cache on success so
 * the catalogue page picks up the new row immediately.
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (hooks)
 */
export function useCreateProduct() {
  return useApiMutation<ProductRow, CreateProductInput>(
    "/api/orgs/current/products",
    "post",
    { invalidateKeys: [PRODUCTS_QUERY_KEY] }
  );
}

/**
 * Updates an existing product. Invalidates BOTH the list cache and
 * the specific product's detail cache so any open editor / list page
 * sees the fresh row immediately.
 *
 * @param id - Product id to update
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (hooks)
 */
export function useUpdateProduct(id: string) {
  return useApiMutation<ProductRow, UpdateProductInput>(
    `/api/orgs/current/products/${id}`,
    "patch",
    { invalidateKeys: [PRODUCTS_QUERY_KEY, productQueryKey(id)] }
  );
}

/**
 * Soft-deletes a product. Invalidates the list cache so the row
 * disappears from the catalogue without a manual refresh.
 *
 * @param id - Product id to delete
 *
 * @author Puran
 * @created 2026-04-08
 * @module Module A - Products (hooks)
 */
export function useDeleteProduct(id: string) {
  return useApiMutation<{ message: string }, void>(
    `/api/orgs/current/products/${id}`,
    "del",
    { invalidateKeys: [PRODUCTS_QUERY_KEY, productQueryKey(id)] }
  );
}
