"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmailIcon, UserIcon, LockIcon } from "@/components/ui/Icons";
import { toast } from "react-toastify";
import { useOAuth } from "@/hooks/useOAuth";
// Old Author: jay
// New Author: Puran
// Impact: merged samir's toast with OAuth Google button + real signup API call
// Reason: combined email/password signup (with toast feedback) + social login (Google/Microsoft)

/**
 * Sign-up form with email/password and social login (Google).
 * Calls POST /api/auth/signup for password registration, form POST for OAuth.
 * Uses toast for success/error feedback.
 * On success redirects to verify-email page.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Signup
 */
export default function SignUpForm() {
  const router = useRouter();
  const { loading: oauthLoading, error: oauthError, initiateOAuth } = useOAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});

  /**
   * Client-side validation matching backend signupSchema rules.
   *
   * @returns Validation errors object (empty if valid)
   *
   * @author Puran
   * @created 2026-04-02
   * @module Auth - Signup
   */
  const validate = () => {
    const newErrors: typeof errors = {};
    if (!fullName.trim()) newErrors.fullName = "Full name is required.";
    if (!email) newErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Enter a valid email address.";
    if (!password) newErrors.password = "Password is required.";
    else if (password.length < 8)
      newErrors.password = "Password must be at least 8 characters.";
    else if (!/[a-z]/.test(password))
      newErrors.password = "Password must contain at least one lowercase letter.";
    else if (!/[A-Z]/.test(password))
      newErrors.password = "Password must contain at least one uppercase letter.";
    else if (!/\d/.test(password))
      newErrors.password = "Password must contain at least one digit.";
    return newErrors;
  };

  /**
   * Submits signup data to /api/auth/signup.
   * On success: shows toast + redirects to verify-email page.
   * On error: shows field-specific or general error messages.
   *
   * @param e - Form submit event
   *
   * @author Puran
   * @created 2026-04-02
   * @module Auth - Signup
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        switch (data.error?.code) {
          case "VALIDATION_ERROR":
            if (data.error?.details) {
              const fieldErrors: typeof errors = {};
              for (const detail of data.error.details) {
                if (detail.field === "fullName") fieldErrors.fullName = detail.message;
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
          case "EMAIL_EXISTS":
            setErrors({ email: "This email is already registered." });
            break;
          case "RATE_LIMITED":
            setErrors({
              general: "Too many signup attempts. Please try again later.",
            });
            break;
          default:
            setErrors({
              general: data.error?.message || "Something went wrong. Please try again.",
            });
        }
        return;
      }

      // Success — toast + redirect to verify-email
      toast.success("Account created! Please check your email for the verification code.");
      router.push(`/verify-email?email=${encodeURIComponent(email)}&mode=signup`);
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
          <h1 className="text-2xl font-bold text-gray-900">Sign Up</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create your account to get started
          </p>
        </div>

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
            className="flex items-center justify-center gap-3 w-full h-12 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
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
            className="flex items-center justify-center gap-3 w-full h-12 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40"
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

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Full Name</p>
            <Input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
              icon={<UserIcon />}
              autoComplete="name"
              disabled={loading}
            />
          </div>

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
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              icon={<LockIcon />}
              autoComplete="new-password"
              disabled={loading}
            />
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

          <Button type="submit" fullWidth loading={loading} size="lg">
            Sign Up
          </Button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[#1a2f6e] hover:underline"
            >
              Log In
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
