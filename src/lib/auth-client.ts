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

// Old Author: samir
// New Author: samir
// Impact: updated to support cookie-based session auth (login sets HttpOnly session_token cookie)
// Reason: login API uses DB sessions with cookies, not JWT tokens in localStorage

const USER_KEY = "perthbch_user";

/** The authenticated user shape stored on the client */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "STAFF" | "DRIVER";
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
 * Clears auth data from localStorage.
 * Call this on logout or when the session expires.
 * The HttpOnly session cookie is cleared by the logout API.
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Client
 */
export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
}

/**
 * Checks if the user is currently authenticated on the client side.
 * Verifies user data exists in localStorage — the actual session
 * validation happens server-side via the HttpOnly session_token cookie.
 *
 * @returns Whether user data is present
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Client
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}
