import {
  getSessionToken,
  deleteSession,
  clearSessionCookieHeader,
} from "@/server/lib/auth/session";
import { error } from "@/server/core/response";
import { logger } from "@/server/lib/logger";

// Old Author: puran
// New Author: samir
// Impact: replaced raw NextResponse.json with success()/error() helpers for consistent API responses
// Reason: align with PROJECT_RULES.md §4.5 standard response format used by other auth routes

const ROUTE = "/api/auth/logout";

/**
 * POST /api/auth/logout
 *
 * Destroys the current database session and clears the session cookie.
 * Works even if no session exists (idempotent).
 *
 * Flow: Extract session token -> Delete DB session -> Clear cookie
 *
 * @param req - The incoming request with session_token cookie
 * @returns Success message with cleared cookie (200) or error response
 *
 * @author samir
 * @created 2026-04-02
 * @module Auth - Logout
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const token = getSessionToken(req);

    if (token) {
      await deleteSession(token);
    }

    logger.info("Logout completed", ctx);

    const responseBody = {
      success: true as const,
      data: { message: "You have been logged out successfully." },
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookieHeader(),
      },
    });
  } catch (err) {
    logger.error("Logout failed", ctx, err);
    return error("INTERNAL_ERROR", "Something went wrong while logging out. Please try again.", 500);
  }
}
