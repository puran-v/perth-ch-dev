/**
 * Next.js 16 proxy (replaces deprecated middleware.ts).
 *
 * Injects a unique x-request-id on every API request for log correlation.
 * Reads existing x-request-id / x-correlation-id from upstream if present,
 * otherwise generates a new UUID. Echoes the ID back on the response.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Observability
 */

// Author: Puran
// Impact: request ID correlation for all API routes
// Reason: structured logging needs a consistent requestId across the request lifecycle

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy handler — attaches x-request-id to every /api/* request and response.
 *
 * @param request - The incoming Next.js request
 * @returns NextResponse with x-request-id header injected
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Observability
 */
export function proxy(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id") ??
    crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Echo request ID on response for support/debugging
  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
