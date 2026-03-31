"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const OtpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const RESEND_SECONDS = 60;

export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode"); // "reset" | "signup"
  const backHref = mode === "reset" ? "/forgot-password" : "/signup";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError("OTP is required.");
      return;
    }
    setError(undefined);
    setLoading(true);
    // TODO: replace with real OTP verification call
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    if (mode === "reset") {
      router.push("/login");
    } else {
      router.push("/login");
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    // TODO: replace with real resend call
    await new Promise((r) => setTimeout(r, 1000));
    setResending(false);
    setCountdown(RESEND_SECONDS);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
        <p className="mt-1 text-sm text-gray-500">
          Please verify your email when signing up
        </p>
      </div>

      {/* Fields + Actions */}
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Enter the OTP</p>
          <Input
            type="text"
            placeholder="xxxxxx"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            error={error}
            icon={<OtpIcon />}
            maxLength={6}
            autoComplete="one-time-code"
            rightElement={
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || resending}
                className={[
                  "text-xs font-medium whitespace-nowrap transition-colors",
                  countdown > 0 || resending
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-[#1a2f6e] hover:underline cursor-pointer",
                ].join(" ")}
              >
                {resending ? "Sending…" : countdown > 0 ? `Send Again (${countdown}s)` : "Send Again"}
              </button>
            }
          />
        </div>

        <Button type="submit" fullWidth loading={loading} size="lg">
          Verify
        </Button>

        <div className="text-center">
          <Link
            href={backHref}
            className="text-sm font-medium text-[#1a2f6e] hover:underline"
          >
            Back
          </Link>
        </div>
      </div>
    </form>
  );
}
