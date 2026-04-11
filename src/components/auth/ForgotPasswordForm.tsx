"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Link from "next/link";
import { EmailIcon } from "@/components/ui/Icons";
import { toast } from "react-toastify";

// Old Author: jay
// New Author: Puran
// Impact: replaced verify-email redirect with inline success state + real API call
// Reason: password reset uses email link, not OTP — verify-email page is wrong destination

// Old Author: Puran
// New Author: samir
// Impact: form now distinguishes "email not registered" / "email not verified" / generic errors
//         and only flips into the success state when the API actually queued a reset email
// Reason: product decision — the API now returns 404 EMAIL_NOT_REGISTERED instead of a neutral
//         success, so the user gets a clear "this email isn't registered, sign up instead" message
//         rather than being told to check an inbox they never owned. Previous behaviour was to
//         always show the success screen to prevent account enumeration.

/**
 * Forgot-password form — collects email, calls forgot-password API,
 * then either shows a "check your email" confirmation inline or surfaces
 * a typed error (not registered / not verified / rate limited).
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Password Reset
 */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  // Author: samir
  // Impact: separate flag for the not-registered case so the form can render a Sign-up link beside the inline error
  // Reason: the shared <Input/> component's `error` prop only accepts a string, so a clickable link can't live inside it. Tracking this as its own boolean keeps the link rendering self-contained without changing the shared primitive.
  const [emailNotRegistered, setEmailNotRegistered] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /**
   * Validates the email locally, then POSTs to /api/auth/forgot-password.
   * The API returns 404 EMAIL_NOT_REGISTERED for unknown emails, 403
   * EMAIL_NOT_VERIFIED for unverified accounts, 429 RATE_LIMITED when
   * throttled, and 200 with a "reset link sent" message on success.
   *
   * @param e - Form submit event
   *
   * @author Puran
   * @created 2026-04-02
   * @module Auth - Password Reset
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("Email is required.");
      setEmailNotRegistered(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      setEmailNotRegistered(false);
      return;
    }

    setError(undefined);
    setEmailNotRegistered(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        const code = data?.error?.code as string | undefined;
        const message = data?.error?.message as string | undefined;

        if (code === "EMAIL_NOT_REGISTERED") {
          setError(message ?? "This email is not registered with us.");
          setEmailNotRegistered(true);
          setLoading(false);
          return;
        }
        if (code === "EMAIL_NOT_VERIFIED") {
          setError(message ?? "This email hasn't been verified yet.");
          setLoading(false);
          return;
        }
        if (code === "RATE_LIMITED") {
          setError("Too many requests. Please try again later.");
          setLoading(false);
          return;
        }
        if (code === "VALIDATION_ERROR") {
          setError(message ?? "Please enter a valid email address.");
          setLoading(false);
          return;
        }

        // Unknown error code — show whatever the server told us, or a generic fallback.
        setError(message ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // 2xx — reset link queued, flip to the "check your inbox" screen.
      setLoading(false);
      setSubmitted(true);
      return;
    } catch {
      toast.error("Unable to connect. Please check your internet and try again.");
      setLoading(false);
    }
  };

  // Author: samir
  // Impact: made forgot-password form fully responsive with constrained width and scaled gaps
  // Reason: gap-16 and unconstrained width caused layout issues on 320px screens

  // Success state — "check your email" confirmation
  if (submitted) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6 items-center text-center max-w-md mx-auto">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <svg
            className="w-7 h-7 sm:w-8 sm:h-8 text-[#1a2f6e]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500">
            If an account exists for <span className="font-medium text-gray-700">{email}</span>,
            we&apos;ve sent a password reset link. Check your inbox and spam folder.
          </p>
        </div>
        <p className="text-sm text-gray-400">
          The link expires in 30 minutes.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-[#1a2f6e] hover:underline"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8 sm:gap-16 max-w-md mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Forgot your password?</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {/* Fields + Actions */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Email address</p>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // Clear stale errors as soon as the user starts typing.
              if (error) setError(undefined);
              if (emailNotRegistered) setEmailNotRegistered(false);
            }}
            error={error}
            icon={<EmailIcon />}
            autoComplete="email"
          />
          {/* Author: samir */}
          {/* Impact: when the API reports EMAIL_NOT_REGISTERED, append a clickable Sign-up link beneath the inline error so users can jump straight to /signup */}
          {/* Reason: the shared <Input/> error slot is plain text only — rendering the link as a sibling node keeps the primitive untouched and preserves keyboard/screen-reader semantics */}
          {emailNotRegistered && (
            <p className="mt-1.5 text-xs text-gray-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-[#1a2f6e] hover:underline"
              >
                Sign up instead.
              </Link>
            </p>
          )}
        </div>

        <Button type="submit" fullWidth loading={loading} size="lg">
          Send Reset Link
        </Button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-[#1a2f6e] hover:underline"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </form>
  );
}
