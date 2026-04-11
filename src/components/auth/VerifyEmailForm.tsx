"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EmailIcon } from "@/components/ui/Icons";
import { toast } from "react-toastify";

// Old Author: jay
// New Author: samir
// Impact: replaced setTimeout stubs with real /api/auth/verify-email and /api/auth/resend-verification calls
// Reason: integrate frontend verify-email form with backend auth APIs


/**
 * Email verification form — collects 6-digit OTP, calls /api/auth/verify-email
 * to confirm the user's email. Includes resend functionality via
 * /api/auth/resend-verification with a 60s cooldown.
 *
 * Handles both signup and reset flows via the mode query param.
 *
 * @author samir
 * @created 2026-04-02
 * @module Auth - Email Verification
 */
export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode"); // "reset" | "signup"
  const emailParam = searchParams.get("email") ?? "";
  const backHref = mode === "reset" ? "/forgot-password" : "/signup";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [successMsg, setSuccessMsg] = useState<string | undefined>();

  /**
   * Submits the OTP code to /api/auth/verify-email for verification.
   * On success: redirects to login page.
   * On error: shows appropriate error message.
   *
   * @param e - Form submit event
   *
   * @author samir
   * @created 2026-04-02
   * @module Auth - Email Verification
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError("OTP is required.");
      return;
    }
    if (otp.trim().length !== 6 || !/^\d+$/.test(otp.trim())) {
      setError("Enter a valid 6-digit code.");
      return;
    }
    if (!emailParam) {
      setError("Email address is missing. Please go back and try again.");
      return;
    }

    setError(undefined);
    setSuccessMsg(undefined);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam, code: otp.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        switch (data.error?.code) {
          case "VALIDATION_ERROR":
            setError("Invalid input. Please check the code and try again.");
            break;
          case "INVALID_OR_EXPIRED_OTP":
            setError("Invalid or expired code. Please request a new one.");
            break;
          case "RATE_LIMITED":
            setError("Too many attempts. Please try again later.");
            break;
          default:
            setError(data.error?.message || "Verification failed. Please try again.");
        }
        return;
      }

      // Success — toast + redirect to login
      toast.success("Email verified successfully! You can now log in.");
      router.push("/login");
    } catch {
      toast.error("Unable to connect. Please check your internet and try again.");
      setError("Unable to connect. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resends the verification OTP via /api/auth/resend-verification.
   * Resets the cooldown timer on success.
   *
   * @author samir
   * @created 2026-04-02
   * @module Auth - Email Verification
   */
  const handleResend = async () => {
    if (!emailParam) return;

    setResending(true);
    setError(undefined);
    setSuccessMsg(undefined);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.code === "RATE_LIMITED") {
          setError("Please wait before requesting another code.");
        } else {
          setError(data.error?.message || "Failed to resend code.");
        }
        return;
      }

      toast.success("A new code has been sent to your email.");
      setSuccessMsg("A new code has been sent to your email.");
    } catch {
      toast.error("Unable to connect. Please try again.");
      setError("Unable to connect. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
        <p className="mt-1 text-sm text-gray-500">
          {emailParam
            ? <>We sent a verification code to <span className="font-medium text-gray-700">{emailParam}</span></>
            : "Please verify your email when signing up"}
        </p>
      </div>

      {/* Fields + Actions */}
      <div className="flex flex-col gap-4">
        {/* Success message for resend */}
        {successMsg && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
            <p className="text-sm text-green-700">{successMsg}</p>
          </div>
        )}

        {/* Author: samir */}
        {/* Impact: moved "Send Again" from inside input to below-right of input */}
        {/* Reason: match Figma — resend link sits below the OTP field, right-aligned */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700">Enter the OTP</p>
          <Input
            type="text"
            placeholder="xxxxxx"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            error={error}
            icon={<EmailIcon />}
            maxLength={6}
            autoComplete="one-time-code"
            disabled={loading}
          />
          <div className="flex justify-end mt-1.5">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || loading}
              className={[
                "text-sm font-medium whitespace-nowrap transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2f6e]/40",
                resending || loading
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-[#1a2f6e] hover:underline cursor-pointer",
              ].join(" ")}
            >
              {resending ? "Sending..." : "Send Again"}
            </button>
          </div>
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
