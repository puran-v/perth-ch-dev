"use client";

/**
 * Shared hook for initiating OAuth sign-in via form POST.
 *
 * Fetches a CSRF token from Auth.js, builds a hidden form, and submits
 * it so the browser follows the 302 redirect to the OAuth provider natively.
 * Works reliably in Next.js 16 where signIn() from next-auth/react doesn't.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - OAuth Hook
 */

// Author: Puran
// Impact: shared OAuth initiation logic for LoginForm and SignUpForm
// Reason: eliminate code duplication + add proper CSRF error handling (§1.1)

import { useState, useCallback } from "react";

/**
 * Provides OAuth sign-in state and an initiateOAuth function.
 *
 * @returns { loading, error, initiateOAuth }
 *
 * @example
 * const { loading, error, initiateOAuth } = useOAuth();
 * <button onClick={() => initiateOAuth("google")}>Continue with Google</button>
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - OAuth Hook
 */
export function useOAuth() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initiates OAuth sign-in by fetching a CSRF token and submitting
   * a hidden form POST to Auth.js signin endpoint.
   *
   * @param provider - The OAuth provider ID ("google" or "microsoft-entra-id")
   *
   * @author Puran
   * @created 2026-04-02
   * @module Auth - OAuth Hook
   */
  const initiateOAuth = useCallback(async (provider: string) => {
    setLoading(provider);
    setError(null);

    try {
      // Fetch CSRF token from Auth.js
      const csrfRes = await fetch("/api/auth/csrf");
      if (!csrfRes.ok) {
        setError("Unable to start social login. Please refresh and try again.");
        setLoading(null);
        return;
      }

      const csrfData = await csrfRes.json();
      if (!csrfData?.csrfToken) {
        setError("Security token missing. Please refresh and try again.");
        setLoading(null);
        return;
      }

      // Submit a hidden form so the browser follows the 302 redirect natively
      const form = document.createElement("form");
      form.method = "POST";
      form.action = `/api/auth/signin/${provider}`;

      const csrfInput = document.createElement("input");
      csrfInput.type = "hidden";
      csrfInput.name = "csrfToken";
      csrfInput.value = csrfData.csrfToken;
      form.appendChild(csrfInput);

      const callbackInput = document.createElement("input");
      callbackInput.type = "hidden";
      callbackInput.name = "callbackUrl";
      callbackInput.value = "/api/auth/oauth/establish";
      form.appendChild(callbackInput);

      document.body.appendChild(form);
      form.submit();
    } catch {
      setError("Failed to start social login. Please try again.");
      setLoading(null);
    }
  }, []);

  return { loading, error, initiateOAuth };
}
