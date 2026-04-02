"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/Input";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { LockIcon } from "@/components/ui/Icons";
import { toast } from "react-toastify";

// Author: Puran
// Impact: new component for password reset step 2
// Reason: collects new password, validates, calls reset-password API with token from URL

/**
 * Reset password form — reads token from URL query param, collects new password
 * with confirmation, validates strength rules, and calls the reset-password API.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Password Reset
 */
export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [success, setSuccess] = useState(false);

  /**
   * Client-side validation matching backend resetPasswordSchema rules.
   *
   * @returns Validation errors object (empty if valid)
   *
   * @author Puran
   * @created 2026-04-02
   * @module Auth - Password Reset
   */
  const validate = () => {
    const newErrors: typeof errors = {};

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    } else if (!/[a-z]/.test(password)) {
      newErrors.password = "Password must contain at least one lowercase letter.";
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = "Password must contain at least one uppercase letter.";
    } else if (!/\d/.test(password)) {
      newErrors.password = "Password must contain at least one digit.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    return newErrors;
  };

  /**
   * Submits the new password + token to the reset-password API.
   * On success shows a confirmation message with login redirect.
   *
   * @param e - Form submit event
   *
   * @author Puran
   * @created 2026-04-02
   * @module Auth - Password Reset
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setErrors({ general: "Invalid or missing reset link. Please request a new one." });
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
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.code === "VALIDATION_ERROR" && data.error?.details) {
          const fieldErrors: typeof errors = {};
          for (const detail of data.error.details) {
            if (detail.field === "password") {
              fieldErrors.password = detail.message;
            }
          }
          setErrors(Object.keys(fieldErrors).length > 0 ? fieldErrors : { general: data.error.message });
        } else if (data.error?.code === "INVALID_OR_EXPIRED_RESET_TOKEN") {
          setErrors({ general: "This reset link has expired or already been used. Please request a new one." });
        } else if (data.error?.code === "RATE_LIMITED") {
          setErrors({ general: "Too many attempts. Please try again later." });
        } else {
          setErrors({ general: data.error?.message || "Something went wrong. Please try again." });
        }
        return;
      }

      toast.success("Password reset successfully!");
      setSuccess(true);
    } catch {
      toast.error("Unable to connect. Please check your internet and try again.");
      setErrors({ general: "Unable to connect. Please check your internet and try again." });
    } finally {
      setLoading(false);
    }
  };

  // Success state — show confirmation with login link
  if (success) {
    return (
      <div className="flex flex-col gap-6 items-center text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Password Reset Successful</h1>
          <p className="mt-2 text-sm text-gray-500">
            Your password has been updated. You can now log in with your new password.
          </p>
        </div>
        <Button
          type="button"
          fullWidth
          size="lg"
          onClick={() => router.push("/login")}
        >
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your new password below. It must be at least 8 characters with uppercase, lowercase, and a digit.
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
          <p className="mb-1.5 text-sm font-medium text-gray-700">New Password</p>
          <PasswordInput
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            icon={<LockIcon />}
            autoComplete="new-password"
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Confirm Password</p>
          <PasswordInput
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            icon={<LockIcon />}
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" fullWidth loading={loading} size="lg">
          Reset Password
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
