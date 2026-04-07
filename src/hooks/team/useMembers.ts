"use client";

/**
 * React Query hooks for members (users) endpoints.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */

// Author: Puran
// Impact: typed hooks for org members list + role update
// Reason: Users tab and Edit member page both consume these

import { useApiQuery } from "@/hooks/useApiQuery";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { Member } from "@/types/team";

/** Cache key for the members list */
export const MEMBERS_QUERY_KEY = ["members"] as const;

/**
 * Fetches the list of active users in the caller's organization.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useMembers() {
  return useApiQuery<Member[]>(
    MEMBERS_QUERY_KEY,
    "/api/orgs/current/members?limit=100"
  );
}

/**
 * Updates a member's organizationRoleId. V1 only allows role change.
 *
 * @param userId - The member's user id
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useUpdateMember(userId: string) {
  return useApiMutation<Member, { organizationRoleId: string }>(
    `/api/orgs/current/members/${userId}`,
    "patch",
    { invalidateKeys: [MEMBERS_QUERY_KEY] }
  );
}

/**
 * Soft-deletes a member from the org. Backend ends every active session
 * for the user in the same transaction so they're kicked out immediately.
 * Watch for the AT_LEAST_ONE_SYSTEM_ADMIN_REQUIRED and CANNOT_REVOKE_SELF
 * error codes — both should be surfaced as toasts on the caller.
 *
 * @param userId - The member's user id
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useRevokeMember(userId: string) {
  return useApiMutation<
    { id: string; fullName: string; message: string },
    void
  >(`/api/orgs/current/members/${userId}`, "del", {
    invalidateKeys: [MEMBERS_QUERY_KEY],
  });
}
