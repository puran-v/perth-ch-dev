import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/server/db/client";
import { forgotPasswordSchema } from "@/server/lib/validation/auth";
import { forgotPasswordLimiter } from "@/server/lib/rate-limit";
import { sendPasswordResetEmail } from "@/server/lib/email/sendPasswordResetEmail";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/auth/forgot-password";
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

function neutralSuccess() {
  return NextResponse.json({
    success: true,
    data: { message: "If an account exists, a password reset link has been sent" },
  });
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

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

    // Rate limit on both IP and email
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const [ipResult, emailResult] = await Promise.all([
      forgotPasswordLimiter.limit(ip),
      forgotPasswordLimiter.limit(email),
    ]);

    if (!ipResult.success || !emailResult.success) {
      logger.warn("Forgot password rate limited", { ...ctx, ip });
      const reset = Math.max(ipResult.reset, emailResult.reset);
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

    const user = await db.user.findUnique({ where: { email } });

    // No user or not verified — neutral response, no leak
    if (!user || !user.isVerified) {
      return neutralSuccess();
    }

    // Invalidate any open reset tokens for this user
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    // Generate token, hash before storing
    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Build reset URL — FRONTEND_URL must be set in production
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      logger.error("FRONTEND_URL not configured", { ...ctx, userId: user.id });
      return neutralSuccess();
    }
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

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
  } catch (error) {
    logger.error("Forgot password failed", ctx, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process request",
        },
      },
      { status: 500 }
    );
  }
}
