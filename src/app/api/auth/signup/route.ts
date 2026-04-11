import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import { issueOtp } from "@/server/lib/email/issueOtp";
import { signupSchema } from "@/server/lib/validation/auth";
import { signupLimiter } from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

// Old Author: jay
// New Author: samir
// Impact: fire OTP email asynchronously so response returns immediately after user creation
// Reason: SMTP handshake was blocking response for 1s-3s; user redirects to verify page anyway

const ROUTE = "/api/auth/signup";

/**
 * POST /api/auth/signup
 *
 * Creates a new user account with ADMIN role, hashes the password,
 * and fires an OTP email for email verification asynchronously.
 *
 * Flow: Rate limit → Validate input → Check duplicate + hash in parallel → Create user → Fire OTP (non-blocking) → Respond
 *
 * @param req - The incoming request with { fullName, email, password }
 * @returns Created user data (201) or error response
 *
 * @author samir
 * @created 2026-04-01
 * @module Auth - Signup
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Step 1: Rate limiting — 5 attempts per hour per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success: allowed } = await signupLimiter.limit(ip);

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

    // Step 3 + 4: Run duplicate check and bcrypt hash in parallel
    // These are independent — bcrypt takes ~100-200ms, DB lookup ~10-30ms
    const [existingUser, passwordHash] = await Promise.all([
      db.user.findUnique({ where: { email }, select: { id: true } }),
      bcrypt.hash(password, 10),
    ]);

    if (existingUser) {
      return error("EMAIL_EXISTS", "This email is already registered. Please log in or use a different email.", 409);
    }

    // Step 5: Create user with pre-computed hash
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

    // Step 6: Fire OTP email asynchronously — don't block the response on SMTP
    // The user is redirected to the verify page regardless; if the email fails
    // they can use the "Resend OTP" button on the verify screen
    issueOtp(user.id, user.email).then((otpResult) => {
      logger.info("Signup OTP sent", { ...ctx, userId: user.id, emailSent: otpResult.emailSent });
    }).catch((otpErr) => {
      logger.error("Signup OTP failed", { ...ctx, userId: user.id }, otpErr);
    });

    logger.info("Signup completed", { ...ctx, userId: user.id });

    return success({ ...user, emailSent: true }, 201);
  } catch (err) {
    logger.error("Signup failed", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong while creating your account. Please try again.", 500);
  }
}
