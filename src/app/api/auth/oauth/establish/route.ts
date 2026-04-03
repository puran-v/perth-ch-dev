/**
 * GET /api/auth/oauth/establish
 *
 * Bridge route: reads the Auth.js JWT session after successful OAuth,
 * creates our app's DB-backed session + session_token httpOnly cookie,
 * clears the Auth.js session cookie, then redirects to dashboard
 * (or org-setup if orgId is null per §2.1).
 *
 * This ensures we have ONE session system (session_token) regardless
 * of whether the user logged in with email/password or OAuth.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - OAuth Bridge
 */

// Author: Puran
// Impact: bridges Auth.js OAuth session to app session_token cookie
// Reason: one session system for all login methods per architecture decision

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { createSession, sessionCookieHeader } from "@/server/lib/auth/session";
import { oauthEstablishLimiter } from "@/server/lib/rate-limit";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/auth/oauth/establish";

/**
 * Handles the OAuth-to-app-session bridge after successful social login.
 * Rate limits by IP, reads userId from Auth.js JWT, creates app session,
 * sets session_token cookie, clears Auth.js cookie, then redirects.
 *
 * @param req - The incoming GET request after OAuth callback
 * @returns 302 redirect to dashboard/org-setup or login (on failure)
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - OAuth Bridge
 */
export async function GET(req: Request): Promise<Response> {
  const ctx = { route: ROUTE };
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  try {
    // Rate limit on IP to prevent abuse
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { success: allowed } = await oauthEstablishLimiter.limit(ip);

    if (!allowed) {
      logger.warn("OAuth establish rate limited", { ...ctx, ip });
      return NextResponse.redirect(new URL("/login?error=TooManyAttempts", baseUrl));
    }

    // Read Auth.js session (JWT with our userId)
    const authSession = await auth();

    if (!authSession?.user?.id) {
      logger.warn("OAuth establish: no valid Auth.js session", ctx);
      return NextResponse.redirect(new URL("/login?error=OAuthSessionExpired", baseUrl));
    }

    const userId = authSession.user.id;

    // Verify user still exists and is active
    const user = await db.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, orgId: true },
    });

    if (!user) {
      logger.warn("OAuth establish: user not found", { ...ctx, userId });
      return NextResponse.redirect(new URL("/login?error=AccountNotFound", baseUrl));
    }

    // Create our app session (same as email/password login)
    const { token, expiresAt } = await createSession(userId);

    // Auth.js JWT cookie expires in 5min (session.maxAge in auth.ts)
    // so it self-cleans — no explicit signOut needed here

    logger.info("OAuth session established", { ...ctx, userId });

    // Redirect: dashboard if org exists, org-setup if not (§2.1 multi-tenant)
    // Append ?oauth=success so the frontend can show a welcome toast
    const redirectPath = user.orgId ? "/dashboard?oauth=success" : "/dashboard/org-setup?oauth=success";

    const response = NextResponse.redirect(new URL(redirectPath, baseUrl));
    response.headers.set("Set-Cookie", sessionCookieHeader(token, expiresAt));

    return response;
  } catch (error) {
    logger.error("OAuth establish failed", ctx, error);
    return NextResponse.redirect(new URL("/login?error=OAuthFailed", baseUrl));
  }
}
