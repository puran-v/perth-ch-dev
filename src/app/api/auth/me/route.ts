/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's profile from the session.
 * Used by the dashboard sidebar, frontend auth state, and any client
 * component that needs the logged-in user's data.
 *
 * Returns orgId so the frontend knows if org setup is needed (§2.1).
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session
 */

// Old Author: Puran
// New Author: Puran
// Impact: surface organizationRole + computed module flags in the response
// Reason: frontend nav + ModuleGuard need module access info to render correctly

import { requireAuth } from "@/server/lib/auth/guards";
import { success, error } from "@/server/core/response";
import { logger } from "@/server/lib/logger";

/**
 * Returns the authenticated user's profile data including orgId.
 * Uses requireAuth guard — returns 401 if not authenticated.
 *
 * Headers: Cache-Control: private, no-store (session data must not be cached).
 *
 * @param req - The incoming request with session_token cookie
 * @returns User profile with orgId (200) or 401 if not authenticated
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - Session
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;

    const ctx = authResult;

    const response = success({
      id: ctx.userId,
      fullName: ctx.fullName,
      email: ctx.email,
      role: ctx.role,
      isVerified: ctx.isVerified,
      orgId: ctx.orgId,
      organizationRoleId: ctx.organizationRoleId,
      organizationRoleName: ctx.organizationRoleName,
      // Computed module flags — ADMIN always gets all five; other users
      // inherit from their assigned OrganizationRole (or all-false if none)
      modules: ctx.modules,
    });

    // Session data must not be cached by proxies or browsers
    response.headers.set("Cache-Control", "private, no-store");

    return response;
  } catch (err) {
    logger.error("Failed to fetch user profile", { route: "/api/auth/me" }, err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
