"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import Link from "next/link";
import { EmailIcon, LockIcon } from "@/components/ui/Icons";
import { useAuth } from "@/hooks";
import { toast } from "react-toastify";

// Old Author: jay
// New Author: samir
// Impact: replaced setTimeout stub with real /api/auth/login API call, added error handling
// Reason: integrate frontend login form with backend auth API

/**
 * Login form — collects email and password, calls /api/auth/login,
 * stores user session, and redirects to dashboard on success.
 *
 * Handles all API error codes: VALIDATION_ERROR, INVALID_CREDENTIALS,
 * EMAIL_NOT_VERIFIED, RATE_LIMITED, INTERNAL_ERROR.
 *
 * @author samir
 * @created 2026-04-02
 * @module Auth - Login
 */
export default function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  /**
   * Client-side validation before hitting the API.
   * Matches backend loginSchema rules for immediate feedback.
   *
   * @returns Validation errors object (empty if valid)
   *
   * @author samir
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
   * On success: stores user data and redirects to dashboard.
   * On error: shows field-specific or general error messages.
   *
   * @param e - Form submit event
   *
   * @author samir
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
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Map API error codes to user-facing messages
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
            setErrors({ general: "Invalid email or password." });
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log In</h1>
        <p className="mt-1 text-sm text-gray-500">
          Log In to your account to continue
        </p>
      </div>

      {/* General error banner — kept in DOM to avoid layout shift/flicker */}
      <div
        className={`rounded-lg bg-red-50 border border-red-200 px-4 py-3 -mb-12 transition-all duration-200 overflow-hidden ${
          errors.general
            ? "opacity-100 max-h-24"
            : "opacity-0 max-h-0 py-0 border-0 mb-0"
        }`}
      >
        <p className="text-sm text-red-700">{errors.general}</p>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">
            Email address
          </p>
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
  );
}
