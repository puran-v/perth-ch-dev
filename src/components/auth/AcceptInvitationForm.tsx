"use client";

/**
 * AcceptInvitationForm — collects full name + password and submits to
 * /api/auth/accept-invitation along with the token from the URL.
 *
 * The endpoint creates the user, attaches them to the inviter's org +
 * role, consumes the invitation, and sets an HttpOnly session cookie so
 * the user is logged in immediately. On success we route straight to
 * the dashboard.
 *
 * Error codes from the backend that get specific handling:
 *   - INVALID_OR_EXPIRED_TOKEN  → generic "expired/revoked" message
 *   - EMAIL_ALREADY_REGISTERED  → inline hint + "go to login" CTA
 *   - VALIDATION_ERROR          → per-field messages (password)
 *   - RATE_LIMITED              → "too many attempts" banner
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Accept Invitation
 */

// Author: Puran
// Impact: new FE form for invitation accept flow
// Reason: backend endpoint shipped — FE must close the loop

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Button from "@/components/ui/Button";
import Input, { PasswordInput } from "@/components/ui/Input";
import { LockIcon, UserIcon } from "@/components/ui/Icons";

interface FieldErrors {
  fullName?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

/**
 * Renders the accept-invitation form. Reads the token from ?token= in
 * the URL; if missing or rejected by the backend, shows a blocking
 * error screen instead of the form.
 *
 * @author Puran
 * @created 2026-04-06
 * @module Auth - Accept Invitation
 */
export default function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  // When the email is already registered we swap the form for a "log in instead" screen
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  // When the token is invalid/expired we swap the form for a dead-end screen
  const [tokenBroken, setTokenBroken] = useState(false);

  /**
   * Client-side validation — mirrors acceptInvitationSchema exactly so the
   * user gets fast feedback before the network round-trip.
   *
   * @returns Field errors object (empty when valid)
   */
  const validate = (): FieldErrors => {
    const next: FieldErrors = {};

    if (!fullName.trim()) {
      next.fullName = "Full name is required.";
    } else if (fullName.trim().length > 120) {
      next.fullName = "Full name must be 120 characters or less.";
    }

    if (!password) {
      next.password = "Password is required.";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    } else if (!/[a-z]/.test(password)) {
      next.password = "Password must contain at least one lowercase letter.";
    } else if (!/[A-Z]/.test(password)) {
      next.password = "Password must contain at least one uppercase letter.";
    } else if (!/\d/.test(password)) {
      next.password = "Password must contain at least one digit.";
    }

    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }

    return next;
  };

  /**
   * Posts the accept body and routes to the dashboard on success.
   * Maps each stable error code from the backend to a specific UI state.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setTokenBroken(true);
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName: fullName.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const code = data.error?.code as string | undefined;

        if (code === "VALIDATION_ERROR" && Array.isArray(data.error?.details)) {
          const fieldErrors: FieldErrors = {};
          for (const detail of data.error.details) {
            if (detail.field === "password") fieldErrors.password = detail.message;
            else if (detail.field === "fullName") fieldErrors.fullName = detail.message;
          }
          setErrors(
            Object.keys(fieldErrors).length > 0
              ? fieldErrors
              : { general: data.error.message }
          );
          return;
        }

        if (code === "INVALID_OR_EXPIRED_TOKEN") {
          setTokenBroken(true);
          return;
        }

        if (code === "EMAIL_ALREADY_REGISTERED") {
          setAlreadyRegistered(true);
          return;
        }

        if (code === "RATE_LIMITED") {
          setErrors({ general: "Too many attempts. Please try again later." });
          return;
        }

        setErrors({
          general: data.error?.message ?? "Something went wrong. Please try again.",
        });
        return;
      }

      toast.success("Welcome aboard!");
      // HttpOnly session cookie is already set by the endpoint — go straight in.
      // Using replace so the user can't hit "back" into the accept form.
      router.replace("/dashboard");
    } catch {
      toast.error("Unable to connect. Please check your internet and try again.");
      setErrors({
        general: "Unable to connect. Please check your internet and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Dead-end: no token in URL, or the backend said the token is gone
  if (tokenBroken) {
    return (
      <div className="flex flex-col gap-6 items-center text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Invitation link unavailable
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            This invitation has expired, already been used, or been revoked.
            Ask the person who invited you to send a new one.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-[#1a2f6e] hover:underline"
        >
          Back to login
        </Link>
      </div>
    );
  }

  // Dead-end: email already belongs to a registered account
  if (alreadyRegistered) {
    return (
      <div className="flex flex-col gap-6 items-center text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            You already have an account
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            An account with this email already exists. Log in with your
            existing password and ask an admin to add you to the team.
          </p>
        </div>
        <Button
          type="button"
          fullWidth
          size="lg"
          onClick={() => router.push("/login")}
        >
          Go to login
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-8 sm:gap-12 max-w-md mx-auto"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Accept your invitation
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up your account to join the team. Your password must be at least
          8 characters with uppercase, lowercase, and a digit.
        </p>
      </div>

      {/* Fields + Actions */}
      <div className="flex flex-col gap-4">
        {errors.general && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{errors.general}</p>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Full name</p>
          <Input
            type="text"
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            icon={<UserIcon />}
            autoComplete="name"
            autoFocus
            disabled={loading}
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Password</p>
          <PasswordInput
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            icon={<LockIcon />}
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">
            Confirm password
          </p>
          <PasswordInput
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            icon={<LockIcon />}
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <Button type="submit" fullWidth loading={loading} size="lg">
          Accept invitation
        </Button>

        <div className="text-center">
          <span className="text-sm text-gray-500">Already have an account? </span>
          <Link
            href="/login"
            className="text-sm font-medium text-[#1a2f6e] hover:underline"
          >
            Log in
          </Link>
        </div>
      </div>
    </form>
  );
}
