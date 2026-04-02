/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's profile from the session.
 * Used by the dashboard sidebar and any client component that needs
 * the logged-in user's name, email, and role.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session
 */

// Author: Puran
// Impact: new endpoint to fetch current user from session cookie
// Reason: sidebar and dashboard need dynamic user data instead of static defaults

import { getSessionToken, validateSession } from "@/server/lib/auth/session";
import { success, error } from "@/server/core/response";

/**
 * Returns the authenticated user's profile data.
 * Reads session_token from cookie, validates it, and returns user info.
 *
 * @param req - The incoming request with session_token cookie
 * @returns User profile (200) or 401 if not authenticated
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session
 */
export async function GET(req: Request): Promise<Response> {
  const token = getSessionToken(req);

  if (!token) {
    return error("UNAUTHORIZED", "Not authenticated.", 401);
  }

  const session = await validateSession(token);

  if (!session) {
    return error("UNAUTHORIZED", "Session expired. Please log in again.", 401);
  }

  return success({
    id: session.user.id,
    fullName: session.user.fullName,
    email: session.user.email,
    role: session.user.role,
  });
}
