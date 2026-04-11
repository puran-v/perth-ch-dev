import crypto from "crypto";
import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import { issueOtp } from "@/server/lib/email/issueOtp";
import { resendVerificationSchema } from "@/server/lib/validation/auth";
import {
  resendCooldownLimiter,
  resendHourlyLimiter,
} from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

// Old Author: jay
// New Author: samir
// Impact: replaced raw NextResponse.json with success()/error() helpers, added JSDoc
// Reason: align with PROJECT_RULES.md §4.5 and §6.3 standard response format

const ROUTE = "/api/auth/resend-verification";

/**
 * Returns a neutral success response that does not reveal whether
 * the email address exists in the system. Used for both "email found"
 * and "email not found" cases to prevent account enumeration.
 *
 * @returns 200 success response with neutral message
 *
 * @author jay
 * @created 2026-04-01
 * @module Auth - Resend Verification
 */
function neutralSuccess(): Response {
  return success({ message: "A new verification code has been sent to your email. Please check your inbox." });
}

/**
 * POST /api/auth/resend-verification
 *
 * Resends a verification OTP to the user's email. Invalidates any
 * existing unused OTP before issuing a new one. Returns a neutral
 * response regardless of whether the email exists to prevent enumeration.
 *
 * Flow: Validate input → Rate limit (cooldown + hourly) → Find user → Issue new OTP
 *
 * @param req - The incoming request with { email }
 * @returns Neutral success message or error response
 *
 * @author jay
 * @created 2026-04-01
 * @module Auth - Resend Verification
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Step 1: Validate input with Zod
    const body = await req.json();
    const parsed = resendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        "VALIDATION_ERROR",
        "Please check your input and try again.",
        400,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      );
    }

    const { email } = parsed.data;

    // Step 2: Rate limit on email — cooldown (1/60s) and hourly cap (5/hr)
    const [cooldown, hourly] = await Promise.all([
      resendCooldownLimiter.limit(email),
      resendHourlyLimiter.limit(email),
    ]);

    if (!cooldown.success || !hourly.success) {
      logger.warn("Resend rate limited", { ...ctx, event: "rate_limited" });
      return error(
        "RATE_LIMITED",
        "Please wait before requesting another code.",
        429
      );
    }

    // Step 3: Find user — neutral response if unknown or already verified (no leak)
    const user = await db.user.findUnique({ where: { email } });

    if (!user || user.isVerified) {
      return neutralSuccess();
    }

    // Author: samir
    // Impact: fire OTP email asynchronously so response returns immediately
    // Reason: SMTP send was blocking response for 500ms-3s; response is neutral regardless
    // Step 4: Issue new OTP (invalidates existing) and send email asynchronously
    issueOtp(user.id, user.email, { invalidateExisting: true })
      .then((otpResult) => {
        if (!otpResult.emailSent) {
          logger.warn("Resend email send failed", { ...ctx, userId: user.id });
        } else {
          logger.info("Resend OTP sent", { ...ctx, userId: user.id });
        }
      })
      .catch((otpErr) => {
        logger.error("Resend OTP failed", { ...ctx, userId: user.id }, otpErr);
      });

    return neutralSuccess();
  } catch (err) {
    logger.error("Resend verification failed", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
