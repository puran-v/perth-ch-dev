"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmailIcon, UserIcon, LockIcon } from "@/components/ui/Icons";

// Old Author: jay
// New Author: samir
// Impact: replaced setTimeout stub with real /api/auth/signup API call, added error handling
// Reason: integrate frontend signup form with backend auth API

/**
 * Sign-up form — collects fullName, email, password, calls /api/auth/signup,
 * then redirects to verify-email page on success.
 *
 * Handles all API error codes: VALIDATION_ERROR, EMAIL_EXISTS,
 * RATE_LIMITED, INTERNAL_ERROR.
 *
 * @author samir
 * @created 2026-04-02
 * @module Auth - Signup
 */
export default function SignUpForm() {
  const router = useRouter();
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
   * Client-side validation before hitting the API.
   * Matches backend signupSchema rules for immediate feedback.
   *
   * @returns Validation errors object (empty if valid)
   *
   * @author samir
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
   * On success: redirects to verify-email with email param.
   * On error: shows field-specific or general error messages.
   *
   * @param e - Form submit event
   *
   * @author samir
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

      // Success — redirect to verify-email with email so the page can display it
      router.push(`/verify-email?email=${encodeURIComponent(email)}&mode=signup`);
    } catch {
      setErrors({
        general: "Unable to connect. Please check your internet and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sign Up</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign Up to your account to continue
        </p>
      </div>

      {/* General error banner */}
      {errors.general && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 -mb-12">
          <p className="text-sm text-red-700">{errors.general}</p>
        </div>
      )}

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
  );
}
