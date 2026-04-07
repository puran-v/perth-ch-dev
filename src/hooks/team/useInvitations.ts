"use client";

/**
 * React Query hooks for invitation endpoints — list pending + bulk create
 * + resend / revoke / remove-expiry actions.
 *
 * All mutations invalidate the invitations list so the Pending tab
 * refreshes automatically after any action.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */

// Author: Puran
// Impact: typed hooks for invitations list + actions
// Reason: centralised cache keys for invite flow

import { useApiQuery } from "@/hooks/useApiQuery";
import { useApiMutation } from "@/hooks/useApiMutation";
import type {
  Invitation,
  BulkInviteInput,
  BulkInviteResult,
} from "@/types/team";

/** Cache key for the pending invitations list */
export const INVITATIONS_QUERY_KEY = ["invitations"] as const;

/**
 * Fetches the list of pending invitations for the caller's org.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useInvitations() {
  return useApiQuery<Invitation[]>(
    INVITATIONS_QUERY_KEY,
    "/api/orgs/current/invitations?limit=100"
  );
}

/**
 * Bulk-creates invitations (max 50 per batch).
 * Returns `{ created, skipped }` so the UI can report partial success.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useCreateInvitations() {
  return useApiMutation<BulkInviteResult, BulkInviteInput>(
    "/api/orgs/current/invitations",
    "post",
    { invalidateKeys: [INVITATIONS_QUERY_KEY] }
  );
}

/**
 * Resends an invitation — rotates the token and resets the expiry.
 *
 * @param id - Invitation id to resend
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useResendInvitation(id: string) {
  return useApiMutation<Invitation, void>(
    `/api/orgs/current/invitations/${id}/resend`,
    "post",
    { invalidateKeys: [INVITATIONS_QUERY_KEY] }
  );
}

/**
 * Revokes a pending invitation. Sets revokedAt on the row.
 *
 * @param id - Invitation id to revoke
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useRevokeInvitation(id: string) {
  return useApiMutation<{ message: string }, void>(
    `/api/orgs/current/invitations/${id}/revoke`,
    "post",
    { invalidateKeys: [INVITATIONS_QUERY_KEY] }
  );
}

/**
 * Removes the expiry on a pending invitation (far-future sentinel).
 *
 * @param id - Invitation id to make non-expiring
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useRemoveInvitationExpiry(id: string) {
  return useApiMutation<Invitation, void>(
    `/api/orgs/current/invitations/${id}/remove-expiry`,
    "patch",
    { invalidateKeys: [INVITATIONS_QUERY_KEY] }
  );
}

/**
 * Resends every pending invitation in the caller's org in one call.
 * Backend rotates tokens for all rows then fires emails sequentially
 * in the background. Returns the count of invitations queued.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useResendAllInvitations() {
  return useApiMutation<{ count: number; message: string }, void>(
    "/api/orgs/current/invitations/resend-all",
    "post",
    { invalidateKeys: [INVITATIONS_QUERY_KEY] }
  );
}
