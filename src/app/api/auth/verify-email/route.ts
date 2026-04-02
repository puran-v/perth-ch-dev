import crypto from "crypto";
import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import { verifyEmailSchema } from "@/server/lib/validation/auth";
import { verifyEmailLimiter } from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

// Old Author: jay
// New Author: samir
// Impact: replaced raw NextResponse.json with success()/error() helpers, added JSDoc
// Reason: align with PROJECT_RULES.md §4.5 and §6.3 standard response format

const ROUTE = "/api/auth/verify-email";

/**
 * Returns a standardised invalid OTP error response.
 * Used for both "user not found" and "wrong code" cases so the API
 * does not reveal whether an email address exists in the system.
 *
 * @returns 400 error response with INVALID_OR_EXPIRED_OTP code
 *
 * @author jay
 * @created 2026-04-01
 * @module Auth - Email Verification
 */
function invalidOtpResponse(): Response {
  return error("INVALID_OR_EXPIRED_OTP", "The code is invalid or has expired. Please request a new one.", 400);
}

/**
 * POST /api/auth/verify-email
 *
 * Verifies a user's email address by validating the OTP code they received.
 * On success, marks the user as verified and consumes the OTP in a single
 * database transaction.
 *
 * Flow: Validate input → Rate limit (IP + email) → Find user → Match OTP → Mark verified
 *
 * @param req - The incoming request with { email, code }
 * @returns Success message or error response
 *
 * @author jay
 * @created 2026-04-01
 * @module Auth - Email Verification
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Step 1: Validate input with Zod
    const body = await req.json();
    const parsed = verifyEmailSchema.safeParse(body);

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

    const { email, code } = parsed.data;

    // Step 2: Rate limit on both IP and email to slow brute force
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const [ipResult, emailResult] = await Promise.all([
      verifyEmailLimiter.limit(ip),
      verifyEmailLimiter.limit(email),
    ]);

    if (!ipResult.success || !emailResult.success) {
      logger.warn("Verify rate limited", { ...ctx, ip });
      return error(
        "RATE_LIMITED",
        "Too many verification attempts. Please try again later.",
        429
      );
    }

    // Step 3: Find user — unified response so we don't reveal whether email exists
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      return invalidOtpResponse();
    }

    // Step 4: Match OTP hash against stored records
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

    // Step 5: Mark verified + consume OTP in one transaction
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

    return success({ message: "Your email has been verified successfully. You can now log in." });
  } catch (err) {
    logger.error("Email verification failed", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong while verifying your email. Please try again.", 500);
  }
}
