"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/Input";
import Checkbox from "@/components/ui/Checkbox";
import Link from "next/link";
import { EmailIcon, LockIcon } from "@/components/ui/Icons";

// dev (jay): admin login form — no redirect yet, pending real auth integration
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  // dev (jay): per-field errors so each input shows its own message independently
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Enter a valid email address.";
    if (!password) newErrors.password = "Password is required.";
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    // dev (jay): bail early and surface errors before hitting the API
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    // TODO: replace with real auth call
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
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
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Password</p>
          {/* dev (jay): autoComplete="current-password" enables browser password manager */}
          <PasswordInput
            placeholder="Password"
            value={password}
            icon={<LockIcon />}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
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
