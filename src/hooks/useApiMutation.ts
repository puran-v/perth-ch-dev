"use client";

/**
 * Typed React Query wrapper for POST/PATCH/PUT/DELETE mutations.
 *
 * Combines the apiClient with useMutation and handles automatic
 * cache invalidation after successful mutations (PROJECT_RULES.md §9.3).
 *
 * @example
 * const { mutate, isPending } = useApiMutation<Booking, CreateBookingInput>(
 *   '/api/bookings',
 *   'post',
 *   { invalidateKeys: [['bookings']] }
 * );
 * mutate({ customerId: '...' });
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - React Query Hooks
 */

// Author: samir
// Impact: new typed React Query mutation wrapper with auto-invalidation
// Reason: PROJECT_RULES.md §9.1 and §9.3 require React Query with cache invalidation

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";

/** HTTP methods supported by the mutation hook */
type MutationMethod = "post" | "patch" | "put" | "del";

/** Options for the mutation hook beyond standard React Query options */
interface MutationHookOptions<TData, TVariables>
  extends Omit<UseMutationOptions<TData, ApiError, TVariables>, "mutationFn"> {
  /** Query keys to invalidate after a successful mutation */
  invalidateKeys?: readonly (readonly unknown[])[];
}

/**
 * Typed wrapper around useMutation that uses the centralised apiClient
 * and automatically invalidates specified cache keys on success.
 *
 * @param url - The API endpoint to call
 * @param method - The HTTP method to use (post, patch, put, del)
 * @param options - React Query mutation options + invalidateKeys
 * @returns Standard useMutation result with typed data
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - React Query Hooks
 */
export function useApiMutation<TData, TVariables = unknown>(
  url: string,
  method: MutationMethod = "post",
  options?: MutationHookOptions<TData, TVariables>
): UseMutationResult<TData, ApiError, TVariables> {
  const queryClient = useQueryClient();
  const { invalidateKeys, ...mutationOptions } = options ?? {};

  return useMutation<TData, ApiError, TVariables>({
    mutationFn: (variables) => {
      if (method === "del") {
        return apiClient.del<TData>(url);
      }
      return apiClient[method]<TData>(url, variables);
    },
    onSuccess: (...args) => {
      // Auto-invalidate specified cache keys after successful mutation
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: [...key] });
        }
      }
      mutationOptions.onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}
