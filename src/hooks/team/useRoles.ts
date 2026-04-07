"use client";

/**
 * React Query hooks for the OrganizationRole CRUD endpoints.
 *
 * Exposes one fetcher (useRoles) and four mutations (create, update,
 * delete, reorder) — all with automatic cache invalidation.
 *
 * @example
 * const { data: roles } = useRoles();
 * const createRole = useCreateRole();
 * createRole.mutate({ name: "Floor Manager", moduleA: true });
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */

// Author: Puran
// Impact: typed hooks for roles list + mutations with auto-invalidation
// Reason: centralised cache keys + error handling for all role operations

import { useApiQuery } from "@/hooks/useApiQuery";
import { useApiMutation } from "@/hooks/useApiMutation";
import type {
  OrganizationRole,
  RoleInput,
  ReorderRolesInput,
} from "@/types/team";

/** Cache key for the roles list — used across hooks for invalidation */
export const ROLES_QUERY_KEY = ["roles"] as const;

/**
 * Fetches the full list of OrganizationRoles for the caller's org.
 * Uses limit=100 (the API max) so V1 doesn't need pagination UI.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useRoles() {
  return useApiQuery<OrganizationRole[]>(
    ROLES_QUERY_KEY,
    "/api/orgs/current/roles?limit=100"
  );
}

/**
 * Creates a new organization role.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useCreateRole() {
  return useApiMutation<OrganizationRole, RoleInput>(
    "/api/orgs/current/roles",
    "post",
    { invalidateKeys: [ROLES_QUERY_KEY] }
  );
}

/**
 * Updates an existing organization role by id.
 * Requires id at call time — builds the URL dynamically.
 *
 * @param id - The role id to update
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useUpdateRole(id: string) {
  return useApiMutation<OrganizationRole, RoleInput>(
    `/api/orgs/current/roles/${id}`,
    "patch",
    { invalidateKeys: [ROLES_QUERY_KEY] }
  );
}

/**
 * Soft-deletes a role. Returns 409 ROLE_IN_USE if any user or
 * pending invitation references it — caller must handle this case.
 *
 * @param id - The role id to delete
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useDeleteRole(id: string) {
  return useApiMutation<{ message: string }, void>(
    `/api/orgs/current/roles/${id}`,
    "del",
    { invalidateKeys: [ROLES_QUERY_KEY] }
  );
}

/**
 * Reorders multiple roles atomically.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Hooks
 */
export function useReorderRoles() {
  return useApiMutation<{ message: string; count: number }, ReorderRolesInput>(
    "/api/orgs/current/roles/reorder",
    "patch",
    { invalidateKeys: [ROLES_QUERY_KEY] }
  );
}
