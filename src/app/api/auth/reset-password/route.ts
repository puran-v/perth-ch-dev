import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import { resetPasswordSchema } from "@/server/lib/validation/auth";
import { resetPasswordLimiter } from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

// Old Author: puran
// New Author: samir
// Impact: replaced raw NextResponse.json with success()/error() helpers for consistent API responses
// Reason: align with PROJECT_RULES.md §4.5 standard response format used by other auth routes

const ROUTE = "/api/auth/reset-password";

/**
 * POST /api/auth/reset-password
 *
 * Validates a password reset token and updates the user's password.
 * On success, consumes the token and invalidates all existing sessions
 * to force re-login, all within a single database transaction.
 *
 * Flow: Validate input -> Rate limit (IP) -> Verify token -> Update password -> Clear sessions
 *
 * @param req - The incoming request with { token, password }
 * @returns Success message (200) or error response
 *
 * @author samir
 * @created 2026-04-02
 * @module Auth - Reset Password
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Step 1: Validate input with Zod
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

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

    const { token, password } = parsed.data;

    // Step 2: Rate limit on IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success: allowed } = await resetPasswordLimiter.limit(ip);

    if (!allowed) {
      logger.warn("Reset password rate limited", { ...ctx, ip });
      return error(
        "RATE_LIMITED",
        "Too many requests. Please try again later.",
        429
      );
    }

    // Step 3: Hash the token and find a valid row
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetToken = await db.passwordResetToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { id: true } },
      },
    });

    if (!resetToken) {
      logger.warn("Invalid or expired reset token", ctx);
      return error(
        "INVALID_OR_EXPIRED_RESET_TOKEN",
        "Invalid or expired reset link",
        400
      );
    }

    const userId = resetToken.user.id;
    const passwordHash = await bcrypt.hash(password, 10);

    // Step 4: Update password + consume token + soft-delete all sessions in one transaction
    // §5.3 — soft delete (set deletedAt) instead of hard delete for audit trail
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { consumedAt: new Date() },
      }),
      db.session.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    logger.info("Password reset successful", { ...ctx, userId });

    return success({ message: "Password has been reset successfully" });
  } catch (err) {
    logger.error("Reset password failed", ctx, err);
    return error("INTERNAL_ERROR", "Failed to reset password", 500);
  }
}
