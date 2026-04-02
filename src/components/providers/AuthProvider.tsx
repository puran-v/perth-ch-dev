"use client";

/**
 * Auth.js SessionProvider wrapper for OAuth client-side functions (signIn, signOut).
 * Required for next-auth/react hooks to work in client components.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Providers
 */

// Author: Puran
// Impact: wraps app in Auth.js SessionProvider for OAuth client functions
// Reason: next-auth/react signIn() requires SessionProvider in the component tree

import { SessionProvider } from "next-auth/react";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
