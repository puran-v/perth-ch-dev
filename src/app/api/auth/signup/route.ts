import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { issueOtp } from "@/server/lib/email/issueOtp";
import { signupSchema } from "@/server/lib/validation/auth";
import { signupLimiter } from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/auth/signup";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success: allowed, reset } = await signupLimiter.limit(ip);

    if (!allowed) {
      logger.warn("Signup rate limited", { ...ctx, ip });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many signup attempts. Please try again later.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
        }
      );
    }

    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

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

    const { fullName, email, password } = parsed.data;

    // Check duplicate email
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_EXISTS",
            message: "Email already registered",
          },
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: "ADMIN",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    // Issue OTP and send email
    const otpResult = await issueOtp(user.id, user.email);

    logger.info("Signup completed", { ...ctx, userId: user.id, emailSent: otpResult.emailSent });

    return NextResponse.json(
      {
        success: true,
        data: { ...user, emailSent: otpResult.emailSent },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Signup failed", ctx, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create account",
        },
      },
      { status: 500 }
    );
  }
}
