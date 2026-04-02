/**
 * DB-backed session management with httpOnly cookie.
 *
 * Sessions are stored in the `sessions` table. Invalidation uses soft delete
 * (setting deletedAt) per PROJECT_RULES.md §5.3 — never hard delete.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session Management
 */

// Author: Puran
// Impact: session CRUD helpers + cookie builders for auth flow
// Reason: DB-backed sessions with httpOnly cookie for login/logout

import crypto from "crypto";
import { db } from "@/server/db/client";

const SESSION_COOKIE_NAME = "session_token";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates a new session row in the database and returns the token + expiry.
 *
 * @param userId - The authenticated user's ID
 * @returns Object containing the raw session token and expiry date
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session Management
 */
export async function createSession(userId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await db.session.create({
    data: { userId, token, expiresAt },
  });

  return { token, expiresAt };
}

/**
 * Validates a session token against the database.
 * Returns the session with user data if valid, null if expired or not found.
 * Expired sessions are soft-deleted (deletedAt set) per §5.3.
 *
 * @param token - The session token from the cookie
 * @returns Session with user data, or null if invalid/expired
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session Management
 */
export async function validateSession(token: string) {
  const session = await db.session.findUnique({
    where: { token, deletedAt: null },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, role: true, isVerified: true },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      // Soft delete expired session (§5.3 — never hard delete)
      await db.session.update({
        where: { id: session.id },
        data: { deletedAt: new Date() },
      }).catch(() => {});
    }
    return null;
  }

  return session;
}

/**
 * Soft-deletes a session by token. Sets deletedAt timestamp
 * rather than removing the row (§5.3 — never hard delete).
 *
 * @param token - The session token to invalidate
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session Management
 */
export async function deleteSession(token: string) {
  await db.session.updateMany({
    where: { token, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

/**
 * Soft-deletes all active sessions for a user. Used on password reset
 * to invalidate all existing logins.
 *
 * @param userId - The user whose sessions should be invalidated
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session Management
 */
export async function invalidateAllSessions(userId: string) {
  await db.session.updateMany({
    where: { userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

/**
 * Builds the Set-Cookie header value for the session.
 * Includes Secure flag only in production.
 *
 * @param token - The session token value
 * @param expiresAt - The session expiry date
 * @returns Formatted Set-Cookie header string
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session Management
 */
export function sessionCookieHeader(token: string, expiresAt: Date): string {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}`,
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Builds a Set-Cookie header that clears the session cookie.
 * Mirrors the same flags as sessionCookieHeader so browsers reliably remove it.
 *
 * @returns Formatted Set-Cookie header string with Max-Age=0
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session Management
 */
export function clearSessionCookieHeader(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Extracts the session token from the Cookie header string.
 *
 * @param req - The incoming request object
 * @returns The session token string, or null if not present
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session Management
 */
export function getSessionToken(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;

  const match = cookie.split(";").find((c) => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return null;

  return match.split("=")[1]?.trim() || null;
}
