import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import { logger } from "@/server/lib/logger";

// Old Author: jay
// New Author: samir
// Impact: updated error() call to match new signature (code, message, status)
// Reason: align with PROJECT_RULES.md §4.5 standard error response format

/**
 * GET /api/health
 *
 * Checks whether the app and database are reachable.
 * Consumed by load balancers, uptime monitors, and post-deploy smoke tests.
 *
 * @returns Health status with DB connectivity and latency
 *
 * @author jay
 * @created 2026-04-01
 * @module Shared - Health Check
 */
export async function GET(): Promise<Response> {
  let dbStatus: "ok" | "error" = "error";
  let dbLatencyMs: number | null = null;

  try {
    const start = Date.now();
    // SELECT 1 is the standard DB liveness ping — no table or model dependency.
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
    dbStatus = "ok";
  } catch (err) {
    logger.error("Health check DB ping failed", { route: "/api/health" }, err);
  }

  const healthy = dbStatus === "ok";

  if (!healthy) {
    // 503 signals to load balancers that this instance should be taken out of rotation.
    return error("DB_UNREACHABLE", "Database unreachable", 503);
  }

  return success({
    status: "ok",
    db: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    timestamp: new Date().toISOString(),
  });
}
