import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { loginSchema } from "@/server/lib/validation/auth";
import { loginLimiter } from "@/server/lib/rate-limit";
import { createSession, sessionCookieHeader } from "@/server/lib/auth/session";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/auth/login";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

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

    const { email, password } = parsed.data;

    // Rate limit on both IP and email
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const [ipResult, emailResult] = await Promise.all([
      loginLimiter.limit(ip),
      loginLimiter.limit(email),
    ]);

    if (!ipResult.success || !emailResult.success) {
      logger.warn("Login rate limited", { ...ctx, ip });
      const reset = Math.max(ipResult.reset, emailResult.reset);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many login attempts. Please try again later.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
        }
      );
    }

    // Load user — generic failure for "bad credentials"
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      logger.warn("Login failed: unknown email", { ...ctx });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      logger.warn("Login failed: wrong password", { ...ctx, userId: user.id });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        },
        { status: 401 }
      );
    }

    if (!user.isVerified) {
      logger.warn("Login failed: email not verified", { ...ctx, userId: user.id });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_NOT_VERIFIED",
            message: "Please verify your email before logging in",
          },
        },
        { status: 403 }
      );
    }

    // Create session + set cookie
    const { token, expiresAt } = await createSession(user.id);

    logger.info("Login successful", { ...ctx, userId: user.id });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      },
      {
        status: 200,
        headers: {
          "Set-Cookie": sessionCookieHeader(token, expiresAt),
        },
      }
    );
  } catch (error) {
    logger.error("Login failed", ctx, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to log in",
        },
      },
      { status: 500 }
    );
  }
}
