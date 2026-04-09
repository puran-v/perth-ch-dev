/**
 * Session guards and RBAC for protected API routes.
 *
 * Provides getAppSession (parse cookie → validate → typed context),
 * requireAuth, requireOrg, requirePermission helpers that API routes
 * call at the top of their handler. Returns typed AuthContext or
 * a standard error Response (§4.5, §6.3).
 *
 * §2.1: orgId is always derived from session, NEVER from client.
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - Guards
 */

// Author: Puran
// Impact: session guards + RBAC for all protected API routes
// Reason: §6.3 pattern — every protected route needs auth + org + permission checks

import { getSessionToken, validateSession } from "./session";
import { error } from "@/server/core/response";
import type { UserRole } from "@/generated/prisma/enums";

// ── Types ────────────────────────────────────────────────────────────

/**
 * Module access flags — mirrors the moduleA..moduleE columns on
 * OrganizationRole. Every request carries these so the frontend + backend
 * can gate feature areas (Module A quoting, Module B inventory, etc.)
 * without an extra DB round-trip.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Guards
 */
export interface ModuleAccess {
  A: boolean;
  B: boolean;
  C: boolean;
  D: boolean;
  E: boolean;
}

/** All modules on — used for ADMIN users who bypass the check entirely */
const ALL_MODULES: ModuleAccess = { A: true, B: true, C: true, D: true, E: true };

/** All modules off — used when a user has no OrganizationRole assigned */
const NO_MODULES: ModuleAccess = { A: false, B: false, C: false, D: false, E: false };

/** Valid module letter keys */
export type ModuleKey = keyof ModuleAccess;

/**
 * Typed session context returned by getAppSession.
 * Contains everything a protected route needs — no passwordHash, no tokens.
 *
 * `modules` is the user's computed module access:
 *   - ADMIN role: always ALL_MODULES (global bypass)
 *   - Has OrganizationRole: copy the role's moduleA..moduleE flags
 *   - No OrganizationRole: NO_MODULES (can still read team/profile, no feature access)
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - Guards
 */
export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  isVerified: boolean;
  orgId: string | null;
  organizationRoleId: string | null;
  organizationRoleName: string | null;
  modules: ModuleAccess;
}

/** AuthContext with orgId guaranteed non-null — returned by requireOrg */
export type OrgAuthContext = AuthContext & { orgId: string };

/**
 * Compile-time permission strings. Typos are caught by TypeScript.
 * Add new permissions here as modules are built.
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - RBAC
 */
export type Permission =
  | "org.settings.read"
  | "org.settings.write"
  | "booking.read"
  | "booking.create"
  | "booking.update"
  | "booking.approve"
  | "booking.delete"
  | "inventory.read"
  | "inventory.update"
  | "product.read"
  | "product.manage"
  | "warehouse.read"
  | "warehouse.update"
  | "finance.read"
  | "finance.write"
  | "team.read"
  | "team.update"
  | "team.invite"
  | "team.manage"
  | "role.read"
  | "role.manage";

// ── Session resolution ───────────────────────────────────────────────

/**
 * Parses the session_token cookie, validates the session against the DB,
 * and returns a typed AuthContext. Returns null if not authenticated.
 *
 * This is the single entry point for all session resolution in the app.
 * Reuses existing getSessionToken + validateSession from session.ts.
 *
 * @param req - The incoming Request object
 * @returns AuthContext if authenticated, null otherwise
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - Guards
 */
export async function getAppSession(req: Request): Promise<AuthContext | null> {
  const token = getSessionToken(req);
  if (!token) return null;

  const session = await validateSession(token);
  if (!session) return null;

  const user = session.user;

  // Compute module access:
  //   - ADMIN users bypass module gates entirely (global access)
  //   - Users with an OrganizationRole inherit its moduleA..E flags
  //   - Users without a role get no module access (can still read profile/team)
  let modules: ModuleAccess;
  if (user.role === "ADMIN") {
    modules = ALL_MODULES;
  } else if (user.organizationRole) {
    modules = {
      A: user.organizationRole.moduleA,
      B: user.organizationRole.moduleB,
      C: user.organizationRole.moduleC,
      D: user.organizationRole.moduleD,
      E: user.organizationRole.moduleE,
    };
  } else {
    modules = NO_MODULES;
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isVerified: user.isVerified,
    orgId: user.orgId,
    organizationRoleId: user.organizationRoleId,
    organizationRoleName: user.organizationRole?.name ?? null,
    modules,
  };
}

// ── Guard helpers ────────────────────────────────────────────────────

/**
 * Requires authentication. Returns AuthContext if valid session exists,
 * or a 401 Response if not.
 *
 * Usage in route handlers:
 * ```ts
 * const authResult = await requireAuth(req);
 * if (authResult instanceof Response) return authResult; // 401
 * const ctx = authResult; // AuthContext
 * ```
 *
 * @param req - The incoming Request object
 * @returns AuthContext or 401 Response
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - Guards
 */
export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  const ctx = await getAppSession(req);
  if (!ctx) {
    return error("UNAUTHORIZED", "Not authenticated. Please log in.", 401);
  }
  return ctx;
}

/**
 * Requires the user to belong to an organization. Returns AuthContext
 * (with guaranteed non-null orgId) or a 403 Response.
 *
 * Must be called after requireAuth — passes through the existing AuthContext.
 *
 * §2.1: All tenant-scoped queries MUST go through this guard.
 *
 * @param ctx - The authenticated context from requireAuth
 * @returns AuthContext (with orgId guaranteed) or 403 Response
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - Guards
 */
// Old Author: Puran
// New Author: Puran
// Impact: removed dev-only org bypass — real org-setup flow is live
// Reason: samir shipped PUT /api/org-setup which auto-creates the Organization
//         on first save and attaches user.orgId. The dev fallback is no longer
//         needed and would have masked any user who skipped org-setup; the
//         dashboard layout now redirects orphan users to /dashboard/org-setup
//         instead (see AdminSidebarWrapper).
export function requireOrg(ctx: AuthContext): OrgAuthContext | Response {
  if (!ctx.orgId) {
    return error(
      "ORG_REQUIRED",
      "You need to set up or join an organization before accessing this resource.",
      403
    );
  }
  return ctx as OrgAuthContext;
}

/**
 * Requires the user to have a specific permission based on their role.
 * Returns the context unchanged if allowed, or a 403 Response.
 *
 * @param ctx - The authenticated context from requireAuth / requireOrg
 * @param permission - The permission to check (compile-time checked via Permission type)
 * @returns Same context type as input (preserves OrgAuthContext narrowing) or 403 Response
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - Guards
 */
export function requirePermission<T extends AuthContext>(ctx: T, permission: Permission): T | Response {
  if (!hasPermission(ctx.role, permission)) {
    return error(
      "FORBIDDEN",
      "You do not have permission to perform this action.",
      403
    );
  }
  return ctx;
}

/**
 * Requires the user's assigned OrganizationRole to have the given module
 * enabled. ADMIN users always pass (their modules are computed as ALL true
 * in getAppSession). Everyone else must have an OrganizationRole with the
 * matching moduleX flag set to true.
 *
 * Use this AFTER requireAuth + requireOrg (+ optional requirePermission) on
 * every feature-area API route. Pair it with a client-side <ModuleGuard>
 * on the corresponding dashboard page so the frontend mirrors the backend.
 *
 * @param ctx - Context from requireOrg (guaranteed orgId)
 * @param module - Which module the route belongs to (A/B/C/D/E)
 * @returns Same context if allowed, or 403 MODULE_FORBIDDEN Response
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Guards
 */
export function requireModule<T extends AuthContext>(
  ctx: T,
  module: ModuleKey
): T | Response {
  if (!ctx.modules[module]) {
    return error(
      "MODULE_FORBIDDEN",
      `Your role does not have access to Module ${module}. Ask an admin to update your role.`,
      403,
      { module }
    );
  }
  return ctx;
}

// ── RBAC permissions ─────────────────────────────────────────────────

/**
 * Static role → permission map. Defines what each role can do.
 *
 * ADMIN: full access to everything
 * MANAGER: can manage bookings, inventory, staff, but not org settings
 * STAFF: can view and perform warehouse operations
 * DRIVER: delivery and pickup operations only
 *
 * This is a static map for now. Can be replaced with DB-backed permissions
 * later without changing the requirePermission API surface.
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - RBAC
 */
const ROLE_PERMISSIONS: Record<UserRole, (Permission | "*")[]> = {
  ADMIN: ["*"], // Wildcard — ADMIN can do everything
  MANAGER: [
    "booking.read", "booking.create", "booking.update", "booking.approve",
    "inventory.read", "inventory.update",
    "product.read", "product.manage",
    "warehouse.read", "warehouse.update",
    "finance.read",
    "team.read", "team.update", "team.invite",
    "role.read",
  ],
  STAFF: [
    "booking.read",
    "inventory.read",
    "product.read",
    "warehouse.read", "warehouse.update",
  ],
  DRIVER: [
    "booking.read",
    "warehouse.read",
  ],
};

/**
 * Checks if a role has a specific permission.
 * ADMIN role has wildcard access ("*") — always returns true.
 *
 * @param role - The user's role
 * @param permission - The permission to check
 * @returns true if the role has the permission
 *
 * @author Puran
 * @created 2026-04-03
 * @module Auth - RBAC
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  // ADMIN wildcard
  if (permissions.includes("*")) return true;
  return permissions.includes(permission);
}
