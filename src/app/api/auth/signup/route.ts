import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import { issueOtp } from "@/server/lib/email/issueOtp";
import { signupSchema } from "@/server/lib/validation/auth";
import { signupLimiter } from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

// Old Author: jay
// New Author: samir
// Impact: replaced raw NextResponse.json with success()/error() helpers, added JSDoc
// Reason: align with PROJECT_RULES.md §4.5 and §6.3 standard response format

const ROUTE = "/api/auth/signup";

/**
 * POST /api/auth/signup
 *
 * Creates a new user account with ADMIN role, hashes the password,
 * and issues an OTP email for email verification.
 *
 * Flow: Rate limit → Validate input → Check duplicate → Create user → Send OTP
 *
 * @param req - The incoming request with { fullName, email, password }
 * @returns Created user data with emailSent flag (201) or error response
 *
 * @author jay
 * @created 2026-04-01
 * @module Auth - Signup
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Step 1: Rate limiting — 5 attempts per hour per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success: allowed, reset } = await signupLimiter.limit(ip);

    if (!allowed) {
      logger.warn("Signup rate limited", { ...ctx, ip });
      return error(
        "RATE_LIMITED",
        "Too many signup attempts. Please try again later.",
        429
      );
    }

    // Step 2: Validate input with Zod
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

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

    const { fullName, email, password } = parsed.data;

    // Step 3: Check duplicate email
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return error("EMAIL_EXISTS", "This email is already registered. Please log in or use a different email.", 409);
    }

    // Step 4: Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);

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

    // Step 5: Issue OTP and send verification email
    const otpResult = await issueOtp(user.id, user.email);

    logger.info("Signup completed", { ...ctx, userId: user.id, emailSent: otpResult.emailSent });

    return success({ ...user, emailSent: otpResult.emailSent }, 201);
  } catch (err) {
    logger.error("Signup failed", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong while creating your account. Please try again.", 500);
  }
}
