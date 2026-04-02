import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { resetPasswordSchema } from "@/server/lib/validation/auth";
import { resetPasswordLimiter } from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/auth/reset-password";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

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

    const { token, password } = parsed.data;

    // Rate limit on IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success: allowed, reset } = await resetPasswordLimiter.limit(ip);

    if (!allowed) {
      logger.warn("Reset password rate limited", { ...ctx, ip });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
        }
      );
    }

    // Hash the token and find a valid row
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
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_OR_EXPIRED_RESET_TOKEN",
            message: "Invalid or expired reset link",
          },
        },
        { status: 400 }
      );
    }

    const userId = resetToken.user.id;
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password + consume token + invalidate all sessions in one transaction
    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { consumedAt: new Date() },
      }),
      db.session.deleteMany({
        where: { userId },
      }),
    ]);

    logger.info("Password reset successful", { ...ctx, userId });

    return NextResponse.json({
      success: true,
      data: { message: "Password has been reset successfully" },
    });
  } catch (error) {
    logger.error("Reset password failed", ctx, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to reset password",
        },
      },
      { status: 500 }
    );
  }
}
