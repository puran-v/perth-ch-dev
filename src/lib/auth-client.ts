/**
 * Client-side authentication utilities.
 *
 * Provides token management and current user retrieval for client components.
 * These functions read/write from localStorage and are used by the ApiService
 * to inject auth headers automatically.
 *
 * For server-side auth, use @/lib/auth.ts instead.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Client
 */

// Author: samir
// Impact: new client-side auth utilities for token and user management
// Reason: PROJECT_RULES.md §1.1 requires shared getToken, getCurrentUser functions

const TOKEN_KEY = "perthbch_token";
const USER_KEY = "perthbch_user";

/** The authenticated user shape stored on the client */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
  orgId: string;
}

/**
 * Retrieves the JWT token from localStorage.
 * Returns null if no token is stored or if running on the server.
 *
 * @returns The stored JWT token or null
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Client
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Stores the JWT token in localStorage.
 *
 * @param token - The JWT token to store
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Client
 */
export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Retrieves the current authenticated user from localStorage.
 * Returns null if no user is stored or if running on the server.
 *
 * @returns The stored AuthUser or null
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Client
 */
export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Stores the current user data in localStorage.
 *
 * @param user - The AuthUser to store
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Client
 */
export function setCurrentUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Clears all auth data from localStorage (token + user).
 * Call this on logout or when the session expires.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Client
 */
export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Checks if the user is currently authenticated.
 * Simply verifies a token exists — does NOT validate it.
 * Server-side validation happens on every API call.
 *
 * @returns Whether a token is present
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Client
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}
