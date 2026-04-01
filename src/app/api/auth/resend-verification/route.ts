import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { issueOtp } from "@/server/lib/email/issueOtp";
import { resendVerificationSchema } from "@/server/lib/validation/auth";
import {
  resendCooldownLimiter,
  resendHourlyLimiter,
} from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/auth/resend-verification";

function neutralSuccess() {
  return NextResponse.json({
    success: true,
    data: { message: "If an account exists, a new code has been sent" },
  });
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const body = await req.json();
    const parsed = resendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Rate limit on email — cooldown (1/60s) and hourly cap (5/hr)
    const [cooldown, hourly] = await Promise.all([
      resendCooldownLimiter.limit(email),
      resendHourlyLimiter.limit(email),
    ]);

    if (!cooldown.success || !hourly.success) {
      logger.warn("Resend rate limited", { ...ctx, event: "rate_limited" });
      const reset = Math.max(cooldown.reset, hourly.reset);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Please wait before requesting another code.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
        },
      );
    }

    const user = await db.user.findUnique({ where: { email } });

    // Unknown email or already verified — neutral response, no leak
    if (!user || user.isVerified) {
      return neutralSuccess();
    }

    // Issue new OTP (invalidates existing) and send email
    const otpResult = await issueOtp(user.id, user.email, {
      invalidateExisting: true,
    });

    if (!otpResult.emailSent) {
      logger.warn("Resend email send failed", { ...ctx, userId: user.id });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_SEND_FAILED",
            message: "Failed to send verification email. Please try again.",
          },
        },
        { status: 502 },
      );
    }

    logger.info("Resend OTP sent", { ...ctx, userId: user.id });

    return neutralSuccess();
  } catch (error) {
    logger.error("Resend verification failed", ctx, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to resend verification code",
        },
      },
      { status: 500 },
    );
  }
}
