"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmailIcon } from "@/components/ui/Icons";

// dev (jay): step 1 of password reset flow — collects email, then hands off to verify-email with mode=reset
export default function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // dev (jay): inline validation — no lib needed for a single field
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
    // TODO: replace with real reset call
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    // dev (jay): passes email via query param so verify-email can display masked address
    router.push(`/verify-email?email=${encodeURIComponent(email)}&mode=reset`);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Forgot your password?</h1>
        <p className="mt-1 text-sm text-gray-500">Reset your password</p>
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
          Send Reset Password Link
        </Button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-[#1a2f6e] hover:underline"
          >
            Back
          </Link>
        </div>
      </div>
    </form>
  );
}
