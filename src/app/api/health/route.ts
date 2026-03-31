import { db } from "@/server/db/client";
import { success, error } from "@/server/core/response";
import { logger } from "@/server/core/logger";

/**
 * GET /api/health
 *
 * Checks whether the app and database are reachable.
 * Consumed by load balancers, uptime monitors, and post-deploy smoke tests.
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
    logger.error("Health check DB ping failed", err);
  }

  const healthy = dbStatus === "ok";

  if (!healthy) {
    // 503 signals to load balancers that this instance should be taken out of rotation.
    return error("Database unreachable", 503, "DB_UNREACHABLE");
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
