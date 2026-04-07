/**
 * TypeScript types for the Team & Users module.
 *
 * Mirrors the backend Prisma models for OrganizationRole, Invitation,
 * and member-shape User fields. API responses for this module return
 * these shapes through the shared PaginatedResponse / ApiSuccess types.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Team - Types
 */

// Author: Puran
// Impact: shared types for frontend role/invite/member consumption
// Reason: one source of truth — hooks, components, and forms import from here

/** User role enum — matches Prisma UserRole */
export type SystemRole = "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";

/**
 * OrganizationRole — org-scoped V1 role with module access flags.
 * Display metadata only for V1; system RBAC still uses User.role enum.
 *
 * `isSystem` marks platform-seeded roles (currently only the founding
 * "Admin" row created by PUT /api/org-setup on first save). System roles
 * are locked against rename / module-toggle / delete by the backend
 * (returns SYSTEM_ROLE_LOCKED) and the frontend mirrors this by hiding
 * edit/delete affordances. Never gate UI on `name === "Admin"` — admins
 * can create their own roles with any name — use `isSystem` instead.
 */
export interface OrganizationRole {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isSystem: boolean;
  moduleA: boolean;
  moduleB: boolean;
  moduleC: boolean;
  moduleD: boolean;
  moduleE: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

/** Payload for creating or updating a role */
export interface RoleInput {
  name: string;
  description?: string | null;
  sortOrder?: number;
  moduleA?: boolean;
  moduleB?: boolean;
  moduleC?: boolean;
  moduleD?: boolean;
  moduleE?: boolean;
}

/** Payload for bulk reorder */
export interface ReorderRolesInput {
  order: { id: string; sortOrder: number }[];
}

/** Invitation row returned from /api/orgs/current/invitations */
export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  /** Optional — captured at invite time, null on legacy invites */
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  organizationRoleId: string;
  expiresAt: string;
  sentAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
  personalMessage: string | null;
  invitedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  organizationRole: {
    id: string;
    name: string;
  };
  invitedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

/**
 * Bulk invite payload — first/last/email/role required, jobTitle and
 * personalMessage are optional and per-invite (so each invitee can get
 * their own custom note instead of a single shared one for the whole
 * batch).
 */
export interface BulkInviteInput {
  invites: {
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    email: string;
    organizationRoleId: string;
    personalMessage?: string | null;
  }[];
}

/** Bulk invite response */
export interface BulkInviteResult {
  created: Invitation[];
  skipped: {
    email: string;
    reason: "ALREADY_MEMBER" | "ALREADY_PENDING";
  }[];
}

/** Member row returned from /api/orgs/current/members */
export interface Member {
  id: string;
  fullName: string;
  email: string;
  role: SystemRole;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * ISO timestamp of the most recent session this user created (login time).
   * `null` if the user has never logged in (e.g. invited but not yet
   * accepted — though those usually live in the Invitation table, not here).
   */
  lastLoginAt: string | null;
  organizationRole: {
    id: string;
    name: string;
    /** True when this is a platform-seeded role like the founding Admin */
    isSystem: boolean;
  } | null;
}

/** Role in-use error payload returned by DELETE /roles/[id] when blocked */
export interface RoleInUseDetails {
  userCount: number;
  inviteCount: number;
}
