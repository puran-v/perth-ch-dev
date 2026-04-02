"use client";

/**
 * Typed React Query wrapper for GET requests.
 *
 * Combines the apiClient with useQuery to provide a consistent
 * pattern for all data fetching in the project. Every list/detail
 * page MUST use this instead of raw useEffect + fetch
 * (PROJECT_RULES.md §9.1).
 *
 * @example
 * const { data, isLoading, error } = useApiQuery<Booking[]>(
 *   ['bookings', orgId],
 *   '/api/bookings'
 * );
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - React Query Hooks
 */

// Author: samir
// Impact: new typed React Query GET wrapper
// Reason: PROJECT_RULES.md §9.1 requires React Query for all server state

import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";

/**
 * Typed wrapper around useQuery that uses the centralised apiClient.
 *
 * @param queryKey - The React Query cache key (e.g. ['bookings', orgId])
 * @param url - The API endpoint to fetch from
 * @param options - Additional React Query options (enabled, staleTime, etc.)
 * @returns Standard useQuery result with typed data
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - React Query Hooks
 */
export function useApiQuery<T>(
  queryKey: readonly unknown[],
  url: string,
  options?: Omit<UseQueryOptions<T, ApiError>, "queryKey" | "queryFn">
): UseQueryResult<T, ApiError> {
  return useQuery<T, ApiError>({
    queryKey,
    queryFn: () => apiClient.get<T>(url),
    ...options,
  });
}
