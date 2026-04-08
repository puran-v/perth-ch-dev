import crypto from "crypto";
import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import { forgotPasswordSchema } from "@/server/lib/validation/auth";
import { forgotPasswordLimiter } from "@/server/lib/rate-limit";
import { sendPasswordResetEmail } from "@/server/lib/email/sendPasswordResetEmail";
import { logger } from "@/server/lib/logger";

// Old Author: puran
// New Author: samir
// Impact: replaced raw NextResponse.json with success()/error() helpers for consistent API responses
// Reason: align with PROJECT_RULES.md §4.5 standard response format used by other auth routes

// Old Author: samir
// New Author: samir
// Impact: forgot-password now reveals whether the email is registered (404 EMAIL_NOT_REGISTERED) instead of returning a neutral success
// Reason: product decision — internal ops tool, the UX win of telling a user "you typed the wrong email, sign up instead" outweighs the account-enumeration leak. Anti-enumeration was the previous default but the form was asked to surface the not-registered case explicitly. Rate limiting + the existing IP/email throttle still cap automated probing.

const ROUTE = "/api/auth/forgot-password";
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Returns a success response confirming the reset link was queued.
 * Sent only when a verified user is found and the token has been
 * persisted — the form treats this as the "check your inbox" signal.
 *
 * @returns 200 success response
 *
 * @author samir
 * @created 2026-04-08
 * @module Auth - Forgot Password
 */
function resetLinkSent(): Response {
  return success({ message: "A password reset link has been sent to your email. Please check your inbox and spam folder." });
}

/**
 * POST /api/auth/forgot-password
 *
 * Generates a time-limited password reset token and sends a reset link
 * to the user's email. Invalidates any existing unused tokens first.
 *
 * Flow: Validate input -> Rate limit (IP + email) -> Find user -> Generate token -> Send email
 *
 * Possible responses:
 * - 200 { success: true,  data: { message } }     reset link queued
 * - 400 VALIDATION_ERROR                           bad email shape
 * - 404 EMAIL_NOT_REGISTERED                       no account for this email
 * - 403 EMAIL_NOT_VERIFIED                         account exists but unverified
 * - 429 RATE_LIMITED                               IP or email throttled
 * - 500 INTERNAL_ERROR                             unexpected server error
 *
 * @param req - The incoming request with { email }
 * @returns Standard success/error response
 *
 * @author samir
 * @created 2026-04-02
 * @module Auth - Forgot Password
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Step 1: Validate input with Zod
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

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

    // Step 2: Rate limit on both IP and email
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const [ipResult, emailResult] = await Promise.all([
      forgotPasswordLimiter.limit(ip),
      forgotPasswordLimiter.limit(email),
    ]);

    if (!ipResult.success || !emailResult.success) {
      logger.warn("Forgot password rate limited", { ...ctx, ip });
      return error(
        "RATE_LIMITED",
        "Too many requests. Please try again later.",
        429
      );
    }

    // Step 3: Find user. Per product decision the route now reveals whether
    // the email is registered (vs the previous anti-enumeration neutral
    // response). Verified vs unverified are surfaced as distinct codes so
    // the form can render distinct copy:
    //   - missing user      → 404 EMAIL_NOT_REGISTERED ("sign up instead")
    //   - unverified user   → 403 EMAIL_NOT_VERIFIED   ("verify your email first")
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, isVerified: true },
    });

    if (!user) {
      logger.info("Forgot password: email not registered", { ...ctx });
      return error(
        "EMAIL_NOT_REGISTERED",
        "This email is not registered with us. Please sign up to create an account.",
        404,
      );
    }

    if (!user.isVerified) {
      logger.info("Forgot password: email not verified", { ...ctx, userId: user.id });
      return error(
        "EMAIL_NOT_VERIFIED",
        "This email hasn't been verified yet. Please verify your email before resetting your password.",
        403,
      );
    }

    // Step 4 + 5: Generate token and invalidate old tokens + create new one in a single transaction
    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    await db.$transaction([
      db.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      db.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    // Step 6: Build reset URL — FRONTEND_URL must be set in production
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      logger.error("FRONTEND_URL not configured", { ...ctx, userId: user.id });
      return resetLinkSent();
    }
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    // Author: samir
    // Impact: fire reset email asynchronously so response returns immediately
    // Reason: SMTP send was blocking response for 500ms-3s; response is neutral regardless
    // Step 7: Send reset email asynchronously — roll back token in background if send fails
    sendPasswordResetEmail(user.email, resetUrl)
      .then(() => {
        logger.info("Password reset email sent", { ...ctx, userId: user.id });
      })
      .catch((emailErr) => {
        logger.error("Password reset email send failed", { ...ctx, userId: user.id }, emailErr);
        db.passwordResetToken.updateMany({
          where: { userId: user.id, tokenHash, consumedAt: null },
          data: { consumedAt: new Date() },
        }).catch(() => {});
      });

    return resetLinkSent();
  } catch (err) {
    logger.error("Forgot password failed", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
