"use client";

/**
 * React Query provider that wraps the entire application.
 *
 * Uses a stable QueryClient reference via useState to avoid
 * re-creating the client on every render. Must be mounted inside
 * the root layout as a client component.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - React Query
 */

// Author: samir
// Impact: new QueryClientProvider wrapper for the app
// Reason: PROJECT_RULES.md §9.1 requires React Query for all server state

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query-client";

/**
 * Provides the React Query context to the entire component tree.
 * Place this in the root layout to enable useQuery/useMutation everywhere.
 *
 * @param children - The app component tree
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - React Query
 */
export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // useState ensures the client is created once and reused across renders
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
