/**
 * Server-side authentication helpers for API routes and server components.
 *
 * Provides JWT token creation/verification, session retrieval from request
 * headers, and RBAC permission checking. Every protected API route uses
 * getServerSession() as the first step (PROJECT_RULES.md §6.3).
 *
 * For client-side auth, use @/lib/auth-client.ts instead.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth
 */

// Old Author: samir
// New Author: samir
// Impact: implemented JWT token creation/verification, real getServerSession from headers
// Reason: PROJECT_RULES.md §1.1 and §6.3 require working auth helpers

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

/** Secret key for JWT signing — derived from AUTH_SECRET env var */
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "fallback-dev-secret-change-in-production"
);

/** JWT token validity duration */
const TOKEN_EXPIRY = "7d";

/** Shape of the JWT payload stored inside the token */
export interface TokenPayload extends JWTPayload {
  userId: string;
  orgId: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
  fullName: string;
}

/** User session returned from authentication — used across all API routes */
export interface UserSession {
  userId: string;
  orgId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
  };
}

/**
 * Creates a signed JWT token for the given user.
 * Called after successful login to issue a session token.
 *
 * @param payload - The user data to encode in the token
 * @returns The signed JWT string
 *
 * @example
 * const token = await createToken({
 *   userId: user.id, orgId: org.id, email: user.email,
 *   role: user.role, fullName: user.fullName,
 * });
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth
 */
export async function createToken(
  payload: Omit<TokenPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verifies and decodes a JWT token.
 * Returns null if the token is invalid, expired, or malformed.
 *
 * @param token - The JWT string to verify
 * @returns The decoded token payload or null
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Retrieves the authenticated user session from the request.
 *
 * Checks for the JWT in this order:
 * 1. Authorization: Bearer <token> header (API calls)
 * 2. auth_token cookie (SSR / server components)
 *
 * Returns null if no valid token is found — callers should return 401.
 * The orgId is ALWAYS derived from the token, never from client input
 * (PROJECT_RULES.md §2.1).
 *
 * @param req - Optional Request object (for API routes). If omitted, reads from cookies.
 * @returns The user session or null if not authenticated
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth
 */
export async function getServerSession(
  req?: Request
): Promise<UserSession | null> {
  let token: string | null = null;

  // Strategy 1: Bearer token from Authorization header (API routes)
  if (req) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  // Strategy 2: Cookie (server components / SSR)
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get("auth_token")?.value ?? null;
    } catch {
      // cookies() throws outside of server component / route handler context
      token = null;
    }
  }

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  return {
    userId: payload.userId,
    orgId: payload.orgId,
    user: {
      id: payload.userId,
      fullName: payload.fullName,
      email: payload.email,
      role: payload.role,
    },
  };
}

/**
 * Checks if a user has a specific permission based on their RBAC role.
 * Role-permission mapping follows PROJECT_RULES.md Section 7.
 *
 * @param user - The user object with role information
 * @param permission - The permission string to check
 * @returns Whether the user has the specified permission
 *
 * @example
 * if (!hasPermission(session.user, 'BOOKING_APPROVE')) {
 *   return error('FORBIDDEN', 'Insufficient permissions', 403);
 * }
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth
 */
export function hasPermission(
  user: { role: string },
  permission: string
): boolean {
  // Role-permission mapping per PROJECT_RULES.md §7.2
  const rolePermissions: Record<string, string[]> = {
    ADMIN: [
      "BOOKING_VIEW", "BOOKING_CREATE", "BOOKING_EDIT", "BOOKING_DELETE", "BOOKING_APPROVE",
      "INVENTORY_VIEW", "INVENTORY_MANAGE",
      "WAREHOUSE_VIEW", "WAREHOUSE_MANAGE",
      "FINANCE_VIEW", "FINANCE_MANAGE",
      "TEAM_MANAGE", "SETTINGS_MANAGE",
    ],
    MANAGER: [
      "BOOKING_VIEW", "BOOKING_CREATE", "BOOKING_EDIT", "BOOKING_APPROVE",
      "INVENTORY_VIEW", "INVENTORY_MANAGE",
      "WAREHOUSE_VIEW", "WAREHOUSE_MANAGE",
      "FINANCE_VIEW", "FINANCE_MANAGE",
      "TEAM_MANAGE",
    ],
    STAFF: [
      "BOOKING_VIEW", "BOOKING_CREATE",
      "INVENTORY_VIEW",
      "WAREHOUSE_VIEW", "WAREHOUSE_MANAGE",
      "FINANCE_VIEW",
    ],
    DRIVER: [
      "BOOKING_VIEW",
      "WAREHOUSE_VIEW", "WAREHOUSE_MANAGE",
    ],
  };

  const permissions = rolePermissions[user.role] ?? [];
  return permissions.includes(permission);
}
