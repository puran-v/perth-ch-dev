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
 * Typed session context returned by getAppSession.
 * Contains everything a protected route needs — no passwordHash, no tokens.
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
  | "warehouse.read"
  | "warehouse.update"
  | "finance.read"
  | "finance.write"
  | "team.read"
  | "team.update";

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

  // orgId comes from validateSession's user select — no extra DB query
  return {
    userId: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    role: session.user.role,
    isVerified: session.user.isVerified,
    orgId: session.user.orgId,
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
    "warehouse.read", "warehouse.update",
    "finance.read",
    "team.read", "team.update",
  ],
  STAFF: [
    "booking.read",
    "inventory.read",
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
