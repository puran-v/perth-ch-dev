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

// Author: samir
// Impact: new auth state management hook for client components
// Reason: PROJECT_RULES.md §1.1 requires shared getCurrentUser, getToken, etc.

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  type AuthUser,
  getToken,
  setToken,
  getCurrentUser,
  setCurrentUser,
  clearAuth,
  isAuthenticated as checkAuth,
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
   * Stores auth credentials and redirects to dashboard.
   *
   * @param token - The JWT token from the login API
   * @param user - The authenticated user data
   */
  login: (token: string, user: AuthUser) => void;
  /** Clears auth data and redirects to login page. */
  logout: () => void;
}

/**
 * Hook for managing client-side authentication state.
 *
 * Initialises from localStorage on mount, provides login/logout
 * actions that update both storage and React state.
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
    const hasToken = checkAuth();
    if (hasToken && storedUser) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    (token: string, userData: AuthUser) => {
      setToken(token);
      setCurrentUser(userData);
      setUser(userData);
      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    router.push("/login");
  }, [router]);

  return {
    user,
    isAuthenticated: !!user && !!getToken(),
    isLoading,
    login,
    logout,
  };
}
