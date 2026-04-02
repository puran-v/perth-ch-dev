"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Link from "next/link";
import { EmailIcon } from "@/components/ui/Icons";

// Old Author: jay
// New Author: Puran
// Impact: replaced verify-email redirect with inline success state + real API call
// Reason: password reset uses email link, not OTP — verify-email page is wrong destination

/**
 * Forgot-password form — collects email, calls forgot-password API,
 * then shows a "check your email" confirmation inline.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Password Reset
 */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);

  /**
   * Validates email and calls the forgot-password API.
   * Always shows success to prevent email enumeration.
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
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setError(undefined);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok && data.error?.code === "RATE_LIMITED") {
        setError("Too many requests. Please try again later.");
        setLoading(false);
        return;
      }
    } catch {
      // Silently continue — neutral response prevents email enumeration
    }

    setLoading(false);
    setSubmitted(true);
  };

  // Success state — "check your email" confirmation
  if (submitted) {
    return (
      <div className="flex flex-col gap-6 items-center text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[#1a2f6e]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Forgot your password?</h1>
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
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            icon={<EmailIcon />}
            autoComplete="email"
          />
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
