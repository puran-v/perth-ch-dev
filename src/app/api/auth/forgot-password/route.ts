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

const ROUTE = "/api/auth/forgot-password";
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Returns a neutral success response that does not reveal whether
 * the email address exists in the system. Used for both "email found"
 * and "email not found" cases to prevent account enumeration.
 *
 * @returns 200 success response with neutral message
 *
 * @author puran
 * @created 2026-04-02
 * @module Auth - Forgot Password
 */
function neutralSuccess(): Response {
  return success({ message: "If an account exists, a password reset link has been sent" });
}

/**
 * POST /api/auth/forgot-password
 *
 * Generates a time-limited password reset token and sends a reset link
 * to the user's email. Invalidates any existing unused tokens first.
 * Returns a neutral response regardless of whether the email exists.
 *
 * Flow: Validate input -> Rate limit (IP + email) -> Find user -> Generate token -> Send email
 *
 * @param req - The incoming request with { email }
 * @returns Neutral success message or error response
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
        "Invalid input",
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

    // Step 3: Find user — neutral response if unknown or unverified (no leak)
    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.isVerified) {
      return neutralSuccess();
    }

    // Step 4: Invalidate any open reset tokens for this user
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    // Step 5: Generate token, hash before storing
    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Step 6: Build reset URL — FRONTEND_URL must be set in production
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      logger.error("FRONTEND_URL not configured", { ...ctx, userId: user.id });
      return neutralSuccess();
    }
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    // Step 7: Send reset email
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
      logger.info("Password reset email sent", { ...ctx, userId: user.id });
    } catch (emailErr) {
      logger.error("Password reset email send failed", { ...ctx, userId: user.id }, emailErr);
      // Consume the token since email didn't go out
      await db.passwordResetToken.updateMany({
        where: { userId: user.id, tokenHash, consumedAt: null },
        data: { consumedAt: new Date() },
      }).catch(() => {});
    }

    return neutralSuccess();
  } catch (err) {
    logger.error("Forgot password failed", ctx, err);
    return error("INTERNAL_ERROR", "Failed to process request", 500);
  }
}
