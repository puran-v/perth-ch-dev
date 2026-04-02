"use client";

/**
 * Client-side auth state hook.
 *
 * Provides the current user, authentication status, and login/logout
 * actions. Reads from localStorage via auth-client utilities and
 * triggers re-renders when auth state changes.
 *
 * @example
 * const { user, isAuthenticated, login, logout } = useAuth();
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Hook
 */

// Old Author: samir
// New Author: samir
// Impact: updated login() to work with cookie-based session (no JWT token param)
// Reason: login API sets HttpOnly session_token cookie, not JWT in response body

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  type AuthUser,
  getCurrentUser,
  setCurrentUser,
  clearAuth,
} from "@/lib/auth-client";

/** Return type of the useAuth hook */
interface UseAuthReturn {
  /** The current authenticated user, or null if not logged in */
  user: AuthUser | null;
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is still loading from storage */
  isLoading: boolean;
  /**
   * Stores user data in localStorage and redirects to dashboard.
   * Auth session is managed via HttpOnly cookie set by the login API.
   *
   * @param user - The authenticated user data from login response
   */
  login: (user: AuthUser) => void;
  /**
   * Clears client auth data and calls logout API to destroy server session.
   * Redirects to login page.
   */
  logout: () => Promise<void>;
}

/**
 * Hook for managing client-side authentication state.
 *
 * Initialises from localStorage on mount, provides login/logout
 * actions that update both storage and React state. Server-side auth
 * is handled via HttpOnly session_token cookie set by the login API.
 *
 * @returns Auth state and actions
 *
 * @author samir
 * @created 2026-04-02
 * @module Shared - Auth Hook
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate auth state from localStorage on mount
  useEffect(() => {
    const storedUser = getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    (userData: AuthUser) => {
      setCurrentUser(userData);
      setUser(userData);
      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(async () => {
    // Call logout API to destroy the server session and clear the cookie
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue with client-side cleanup even if API fails
    }
    clearAuth();
    setUser(null);
    router.push("/login");
  }, [router]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };
}
