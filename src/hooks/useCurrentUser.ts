"use client";

/**
 * React Query hook for the logged-in user profile.
 *
 * Wraps GET /api/auth/me so every client component gets the same cached
 * user object — system role, org membership, and computed module access
 * flags — without each one firing its own fetch. Invalidation points to
 * watch: login, logout, accept-invitation, and the (future) org-setup
 * completion flow should all call queryClient.invalidateQueries on
 * CURRENT_USER_QUERY_KEY so the UI updates immediately.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Hooks
 */

// Author: Puran
// Impact: centralises /api/auth/me into a typed React Query hook
// Reason: sidebar, module guards, and any future "can I see X?" check
//         all need the same user snapshot — one cache, one source of truth

import { useApiQuery } from "@/hooks/useApiQuery";
import type { UserRole } from "@/generated/prisma/enums";

/** Cache key for the current-user query — exported so mutations can invalidate it */
export const CURRENT_USER_QUERY_KEY = ["currentUser"] as const;

/**
 * Module access flags — keys match the A..E suffix on OrganizationRole.
 * Mirrors the ModuleAccess type in server/lib/auth/guards.ts so the FE
 * and BE share the same shape.
 */
export interface CurrentUserModules {
  A: boolean;
  B: boolean;
  C: boolean;
  D: boolean;
  E: boolean;
}

/** Shape returned by GET /api/auth/me — the full logged-in user snapshot */
export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  orgId: string | null;
  organizationRoleId: string | null;
  organizationRoleName: string | null;
  modules: CurrentUserModules;
}

/**
 * Fetches and caches the current authenticated user.
 * Returns loading/error/data from React Query — callers should handle
 * the undefined-while-loading case.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Hooks
 */
export function useCurrentUser() {
  return useApiQuery<CurrentUser>(CURRENT_USER_QUERY_KEY, "/api/auth/me", {
    // User identity doesn't change mid-session — cache aggressively so the
    // sidebar + module guards don't refetch on every page transition.
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
