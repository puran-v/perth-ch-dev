import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/server/db/client";
import { verifyEmailSchema } from "@/server/lib/validation/auth";
import { verifyEmailLimiter } from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/auth/verify-email";

function invalidOtpResponse() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INVALID_OR_EXPIRED_OTP",
        message: "Invalid or expired code",
      },
    },
    { status: 400 }
  );
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const body = await req.json();
    const parsed = verifyEmailSchema.safeParse(body);

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

    const { email, code } = parsed.data;

    // Rate limit on both IP and email to slow brute force
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const [ipResult, emailResult] = await Promise.all([
      verifyEmailLimiter.limit(ip),
      verifyEmailLimiter.limit(email),
    ]);

    if (!ipResult.success || !emailResult.success) {
      logger.warn("Verify rate limited", { ...ctx, ip });
      const reset = Math.max(ipResult.reset, emailResult.reset);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many verification attempts. Please try again later.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
        }
      );
    }

    const user = await db.user.findUnique({ where: { email } });

    // Gap #5: unified response — don't reveal whether email exists
    if (!user) {
      return invalidOtpResponse();
    }

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    const otp = await db.emailVerificationOtp.findFirst({
      where: {
        userId: user.id,
        codeHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      logger.warn("Invalid OTP attempt", { ...ctx, userId: user.id });
      return invalidOtpResponse();
    }

    // mark verified + consume OTP in one transaction
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      }),
      db.emailVerificationOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    logger.info("Email verified", { ...ctx, userId: user.id });

    return NextResponse.json({
      success: true,
      data: { message: "Email verified successfully" },
    });
  } catch (error) {
    logger.error("Email verification failed", ctx, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to verify email",
        },
      },
      { status: 500 }
    );
  }
}
