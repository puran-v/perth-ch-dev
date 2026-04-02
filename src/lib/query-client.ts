/**
 * Shared React Query client configuration.
 *
 * All server state in the project MUST use React Query (PROJECT_RULES.md §9.1).
 * This file configures sensible defaults for stale time, retry, and refetch
 * behaviour across all queries.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - React Query
 */

// Author: samir
// Impact: new React Query client singleton for the entire app
// Reason: PROJECT_RULES.md §9.1 mandates React Query for all server state

import { QueryClient } from "@tanstack/react-query";

/**
 * Creates a new QueryClient with project-wide defaults.
 *
 * Defaults:
 * - staleTime: 30 seconds (avoid excessive refetches)
 * - retry: 1 (fail fast, show error state quickly)
 * - refetchOnWindowFocus: false (reduce unnecessary API load)
 *
 * @returns Configured QueryClient instance
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - React Query
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
