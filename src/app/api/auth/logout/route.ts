import { NextResponse } from "next/server";
import {
  getSessionToken,
  deleteSession,
  clearSessionCookieHeader,
} from "@/server/lib/auth/session";
import { logger } from "@/server/lib/logger";

const ROUTE = "/api/auth/logout";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const ctx = { route: ROUTE, requestId };

  try {
    const token = getSessionToken(req);

    if (token) {
      await deleteSession(token);
    }

    logger.info("Logout completed", ctx);

    return NextResponse.json(
      {
        success: true,
        data: { message: "Logged out successfully" },
      },
      {
        status: 200,
        headers: {
          "Set-Cookie": clearSessionCookieHeader(),
        },
      }
    );
  } catch (error) {
    logger.error("Logout failed", ctx, error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to log out",
        },
      },
      { status: 500 }
    );
  }
}
