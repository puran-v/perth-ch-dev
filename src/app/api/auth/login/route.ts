import bcrypt from "bcryptjs";
import { db } from "@/server/db/client";
import { error } from "@/server/core/response";
import { loginSchema } from "@/server/lib/validation/auth";
import { loginLimiter } from "@/server/lib/rate-limit";
import { createSession, sessionCookieHeader } from "@/server/lib/auth/session";
import { logger } from "@/server/lib/logger";

// Old Author: puran
// New Author: samir
// Impact: replaced raw NextResponse.json with success()/error() helpers for consistent API responses
// Reason: align with PROJECT_RULES.md §4.5 standard response format used by other auth routes

const ROUTE = "/api/auth/login";

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password, creates a database-backed
 * session, and returns the user profile with a session cookie.
 *
 * Flow: Validate input -> Rate limit (IP + email) -> Verify credentials -> Create session
 *
 * Session lifetime is driven by the optional `rememberMe` flag on the body:
 *  - rememberMe = true  → 30 days (long-lived "keep me signed in")
 *  - rememberMe = false → 1 day  (default, safer for shared workstations)
 *
 * @param req - The incoming request with { email, password, rememberMe? }
 * @returns User data with session cookie (200) or error response
 *
 * @author samir
 * @created 2026-04-02
 * @module Auth - Login
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    // Step 1: Validate input with Zod
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

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

    // Author: samir
    // Impact: pull rememberMe out of the parsed body so we can pass it to createSession()
    // Reason: drives the session-cookie lifetime — checked = 30-day session, unchecked = 1-day session. Defaulted to false in the schema, so legacy clients (and tests) that omit the field still get the safer short-lived session.
    const { email, password, rememberMe } = parsed.data;

    // Step 2: Rate limit on both IP and email to slow brute force
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const [ipResult, emailResult] = await Promise.all([
      loginLimiter.limit(ip),
      loginLimiter.limit(email),
    ]);

    if (!ipResult.success || !emailResult.success) {
      logger.warn("Login rate limited", { ...ctx, ip });
      return error(
        "RATE_LIMITED",
        "Too many login attempts. Please try again later.",
        429
      );
    }

    // Step 3: Load user — only select fields needed for auth check + response
    // §5.3: filter out soft-deleted users
    const user = await db.user.findUnique({
      where: { email, deletedAt: null },
      select: { id: true, fullName: true, email: true, role: true, passwordHash: true, isVerified: true },
    });

    if (!user) {
      logger.warn("Login failed: unknown email", { ...ctx });
      return error("INVALID_CREDENTIALS", "The email or password you entered is incorrect.", 401);
    }

    // Step 4: Verify password — OAuth-only users have null passwordHash
    if (!user.passwordHash) {
      logger.warn("Login failed: OAuth-only account", { ...ctx, userId: user.id });
      return error(
        "OAUTH_ONLY_ACCOUNT",
        "This account uses social login. Please sign in with Google or Microsoft.",
        401
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      logger.warn("Login failed: wrong password", { ...ctx, userId: user.id });
      return error("INVALID_CREDENTIALS", "The email or password you entered is incorrect.", 401);
    }

    // Step 5: Check email verification status
    if (!user.isVerified) {
      logger.warn("Login failed: email not verified", { ...ctx, userId: user.id });
      return error(
        "EMAIL_NOT_VERIFIED",
        "Please verify your email before logging in. Check your inbox for the verification code.",
        403
      );
    }

    // Step 6: Create session + build cookie header
    const { token, expiresAt } = await createSession(user.id, { rememberMe });

    logger.info("Login successful", { ...ctx, userId: user.id, rememberMe });

    const responseBody = {
      success: true as const,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": sessionCookieHeader(token, expiresAt),
      },
    });
  } catch (err) {
    logger.error("Login failed", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong while logging in. Please try again.", 500);
  }
}
