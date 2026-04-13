"use client";

/**
 * React Query hooks for the Bundles API
 * (`/api/orgs/current/bundles` + `/[id]`).
 *
 * Every consumer — bundles list page, quote builder — goes through
 * these hooks. They centralise the cache key strategy, URL strings,
 * and response shapes.
 *
 * Mirrors the `src/hooks/products/useProducts.ts` pattern.
 *
 * @example
 * const { data: bundles, isLoading } = useBundleList();
 * const create = useCreateBundle();
 * create.mutate({ name: "Kids Party Starter", productIds: ["..."] });
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (hooks)
 */

// Author: samir
// Impact: typed bundle hooks for list / detail / create / update / delete
// Reason: replaces MOCK_BUNDLES in the bundles page with real API calls

import { useApiQuery } from "@/hooks/useApiQuery";
import { useApiMutation } from "@/hooks/useApiMutation";
import type {
  BundleRow,
  CreateBundleInput,
  UpdateBundleInput,
} from "@/types/bundles";

/** Root cache key for everything Bundles. */
export const BUNDLES_QUERY_KEY = ["bundles"] as const;

/** Cache key for a single bundle detail. */
export const bundleQueryKey = (id: string) =>
  [...BUNDLES_QUERY_KEY, id] as const;

/**
 * Fetches the list of bundles for the caller's org.
 * Uses limit=100 so V1 doesn't need pagination UI.
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (hooks)
 */
export function useBundleList() {
  return useApiQuery<BundleRow[]>(
    BUNDLES_QUERY_KEY,
    "/api/orgs/current/bundles?limit=100"
  );
}

/**
 * Fetches a single bundle by id. Pass `undefined` to disable the query.
 *
 * @param id - Bundle id, or undefined to skip the fetch
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (hooks)
 */
export function useBundle(id: string | undefined) {
  return useApiQuery<BundleRow>(
    bundleQueryKey(id ?? "__none__"),
    `/api/orgs/current/bundles/${id}`,
    { enabled: Boolean(id) }
  );
}

/**
 * Creates a new bundle. Invalidates the list cache on success.
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (hooks)
 */
export function useCreateBundle() {
  return useApiMutation<BundleRow, CreateBundleInput>(
    "/api/orgs/current/bundles",
    "post",
    { invalidateKeys: [BUNDLES_QUERY_KEY] }
  );
}

/**
 * Updates an existing bundle. Invalidates both list and detail caches.
 *
 * @param id - Bundle id to update
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (hooks)
 */
export function useUpdateBundle(id: string) {
  return useApiMutation<BundleRow, UpdateBundleInput>(
    `/api/orgs/current/bundles/${id}`,
    "patch",
    { invalidateKeys: [BUNDLES_QUERY_KEY, bundleQueryKey(id)] }
  );
}

/**
 * Soft-deletes a bundle. Invalidates the list cache.
 *
 * @param id - Bundle id to delete
 *
 * @author samir
 * @created 2026-04-13
 * @module Module A - Bundles & Packages (hooks)
 */
export function useDeleteBundle(id: string) {
  return useApiMutation<{ message: string }, void>(
    `/api/orgs/current/bundles/${id}`,
    "del",
    { invalidateKeys: [BUNDLES_QUERY_KEY, bundleQueryKey(id)] }
  );
}
