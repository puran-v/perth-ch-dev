import crypto from "crypto";
import { db } from "@/server/db/client";

const SESSION_COOKIE_NAME = "session_token";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Create a new session row and return the token + cookie header value.
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
 * Validate a session token. Returns the session + user if valid, null otherwise.
 */
export async function validateSession(token: string) {
  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, role: true, isVerified: true },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      // Clean up expired session
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  return session;
}

/**
 * Delete a session by token.
 */
export async function deleteSession(token: string) {
  await db.session.deleteMany({ where: { token } });
}

/**
 * Build the Set-Cookie header value for the session.
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
 * Build a Set-Cookie header that clears the session cookie.
 * Mirrors the same flags as sessionCookieHeader so browsers reliably remove it.
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
 * Extract session token from the Cookie header.
 */
export function getSessionToken(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;

  const match = cookie.split(";").find((c) => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return null;

  return match.split("=")[1]?.trim() || null;
}
