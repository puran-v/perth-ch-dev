"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmailIcon, LockIcon } from "@/components/ui/Icons";
import { useAuth } from "@/hooks";
import { useOAuth } from "@/hooks/useOAuth";
import { consumeSignupRememberMePreference } from "@/lib/auth-client";
import { toast } from "react-toastify";
// Old Author: jay
// New Author: Puran
// Impact: merged samir's useAuth/toast with OAuth Google button + error handling from URL params
// Reason: combined email/password login (with session storage) + social login (Google/Microsoft)

// Author: samir
// Impact: Remember Me checkbox is now wired to the API — checked = 30-day session, unchecked = 1-day session.
//         Also reads a one-shot localStorage carry-over (consumeSignupRememberMePreference) written by SignUpForm so a
//         user who picked Remember Me on signup gets the box pre-checked the first time they log in after verifying.
// Reason: signup doesn't create a session, so the preference can't live in a server cookie. The helper in
//         @/lib/auth-client encapsulates the localStorage key + try/catch so the two forms can't drift on the contract.

/**
 * Login form with email/password and social login (Google).
 * Calls POST /api/auth/login for password auth, form POST for OAuth.
 * Uses useAuth hook to store user in client state + toast for feedback.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Login
 */
export default function LoginForm() {
  const { login } = useAuth();
  const { loading: oauthLoading, error: oauthError, initiateOAuth } = useOAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  // Show error from OAuth redirects (e.g. ?error=AccountNotFound)
  const urlError = searchParams.get("error");
  const oauthErrorMessage =
    urlError === "AccountNotFound"
      ? "No account found with this email. Please sign up first."
      : urlError === "OAuthSessionExpired"
        ? "Your session expired. Please try again."
        : urlError === "OAuthFailed"
          ? "Social login failed. Please try again."
          : urlError === "TooManyAttempts"
            ? "Too many attempts. Please try again later."
            : urlError === "EmailNotVerified"
              ? "Your email is not verified by the provider. Please use a verified account."
              : urlError === "AccountDeleted"
                ? "This account has been deactivated. Please contact your admin."
                : null;

  // Show toast for OAuth errors on mount (once)
  useEffect(() => {
    if (oauthErrorMessage) {
      toast.error(oauthErrorMessage);
      // Clean up URL param so toast doesn't re-fire on navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Author: samir
  // Impact: pre-check the Remember Me box if the user opted in during signup.
  //         The helper reads-and-removes the localStorage key so the carry-over
  //         is one-shot — a different user logging in on the same machine will
  //         not inherit the previous user's choice.
  // Reason: signup happens before any session exists, so the user's intent has
  //         to live somewhere outside a server cookie until first login.
  useEffect(() => {
    const carriedOver = consumeSignupRememberMePreference();
    if (carriedOver === true) {
      setRememberMe(true);
    }
  }, []);

  /**
   * Client-side validation before hitting the API.
   * Matches backend loginSchema rules for immediate feedback.
   *
   * @returns Validation errors object (empty if valid)
   *
   * @author Puran
   * @created 2026-04-02
   * @module Auth - Login
   */
  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Enter a valid email address.";
    if (!password) newErrors.password = "Password is required.";
    return newErrors;
  };

  /**
   * Submits login credentials to /api/auth/login.
   * On success: stores user data via useAuth, shows toast, redirects to dashboard.
   * On error: shows field-specific or general error messages.
   *
   * @param e - Form submit event
   *
   * @author Puran
   * @created 2026-04-02
   * @module Auth - Login
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors((prev) => ({ general: prev.general }));
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        switch (data.error?.code) {
          case "VALIDATION_ERROR":
            if (data.error?.details) {
              const fieldErrors: typeof errors = {};
              for (const detail of data.error.details) {
                if (detail.field === "email") fieldErrors.email = detail.message;
                if (detail.field === "password") fieldErrors.password = detail.message;
              }
              setErrors(
                Object.keys(fieldErrors).length > 0
                  ? fieldErrors
                  : { general: data.error.message }
              );
            } else {
              setErrors({ general: data.error.message });
            }
            break;
          case "INVALID_CREDENTIALS":
            setErrors({ general: "The email or password you entered is incorrect." });
            break;
          case "OAUTH_ONLY_ACCOUNT":
            setErrors({ general: "This account uses social login. Please sign in with Google or Microsoft." });
            break;
          case "EMAIL_NOT_VERIFIED":
            setErrors({
              general:
                "Please verify your email before logging in. Check your inbox for the verification code.",
            });
            break;
          case "RATE_LIMITED":
            setErrors({
              general: "Too many login attempts. Please try again later.",
            });
            break;
          default:
            setErrors({
              general: data.error?.message || "Something went wrong. Please try again.",
            });
        }
        return;
      }

      // Success — show toast, store user data, and redirect (cookie is set by API response)
      toast.success(`Welcome back, ${data.data.fullName}!`);
      login({
        id: data.data.id,
        fullName: data.data.fullName,
        email: data.data.email,
        role: data.data.role,
      });
    } catch {
      toast.error("Unable to connect. Please check your internet and try again.");
      setErrors({
        general: "Unable to connect. Please check your internet and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-16">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Log In</h1>
          <p className="mt-1 text-sm text-gray-500">
            Log In to your account to continue
          </p>
        </div>

        {/* OAuth error from URL */}
        {oauthErrorMessage && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{oauthErrorMessage}</p>
          </div>
        )}

        {/* OAuth hook error */}
        {oauthError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{oauthError}</p>
          </div>
        )}

        {/* General error banner */}
        {errors.general && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{errors.general}</p>
          </div>
        )}

        {/* Social login buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={oauthLoading !== null || loading}
            onClick={() => initiateOAuth("google")}
            className="flex items-center justify-center gap-3 w-full h-12 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {oauthLoading === "google" ? "Connecting..." : "Continue with Google"}
          </button>

          <button
            type="button"
            disabled={oauthLoading !== null || loading}
            onClick={() => initiateOAuth("microsoft-entra-id")}
            className="flex items-center justify-center gap-3 w-full h-12 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 23 23">
              <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
              <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
            </svg>
            {oauthLoading === "microsoft-entra-id" ? "Connecting..." : "Continue with Microsoft"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email/Password fields */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Email address</p>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              icon={<EmailIcon />}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Password</p>
            <PasswordInput
              placeholder="Password"
              value={password}
              icon={<LockIcon />}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
        </div>

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <Checkbox
            label="Remember me"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[#1a2f6e] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <Button type="submit" fullWidth loading={loading} size="lg">
          Sign In
        </Button>

        <p className="text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-[#1a2f6e] hover:underline"
          >
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  );
}
