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

// Author: samir
// Impact: localStorage key used to carry the Remember Me choice from the
//         signup form to the user's first login. Signup writes it; LoginForm
//         reads-and-removes it on mount so the carry-over is one-shot and
//         doesn't contaminate other users on shared machines.
// Reason: signup doesn't create a session today, so the preference can't
//         live in a cookie or DB column without extra plumbing. localStorage
//         is the simplest honest place for an intent that has no effect
//         until first login.
const SIGNUP_REMEMBER_ME_KEY = "pbch:signupRememberMe";

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

/**
 * Stores the user's Remember Me choice from the signup form so the
 * login form can pre-check the box on the user's first login. Wrapped
 * in try/catch because localStorage can throw in private mode or when
 * storage is full — failing here must not block signup.
 *
 * @param rememberMe - The user's choice on the signup checkbox
 *
 * @author samir
 * @created 2026-04-08
 * @module Shared - Auth Client
 */
export function writeSignupRememberMePreference(rememberMe: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIGNUP_REMEMBER_ME_KEY, rememberMe ? "1" : "0");
  } catch {
    // localStorage unavailable — silently ignore. The login form will
    // simply leave the box unchecked, which is the safe default.
  }
}

/**
 * Reads-and-removes the signup Remember Me preference. Designed as a
 * one-shot consumer: returns the stored value (or null) and immediately
 * deletes the key so a different user signing in on the same machine
 * doesn't inherit the previous user's choice.
 *
 * @returns true / false / null when nothing is stored
 *
 * @author samir
 * @created 2026-04-08
 * @module Shared - Auth Client
 */
export function consumeSignupRememberMePreference(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(SIGNUP_REMEMBER_ME_KEY);
    if (stored === null) return null;
    window.localStorage.removeItem(SIGNUP_REMEMBER_ME_KEY);
    return stored === "1";
  } catch {
    return null;
  }
}
