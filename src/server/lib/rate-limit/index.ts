/**
 * Rate limiter factory — Upstash Redis in production, in-memory fallback for dev.
 *
 * All rate limiting is DISABLED by default (RATE_LIMIT_ENABLED !== "true").
 * Set RATE_LIMIT_ENABLED=true in .env when ready to enforce limits.
 *
 * Each limiter exposes a `.limit(key)` method returning `{ success, reset }`.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Rate Limiting
 */

// Author: Puran
// Impact: rate limiters for all auth routes — disabled by default for dev
// Reason: prevent abuse on expensive operations when live; no friction during dev

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createMemoryCooldown, createMemorySlidingWindow } from "./memory";
import { logger } from "@/server/lib/logger";

/**
 * When rate limiting is disabled, all limiters return success immediately.
 * Set RATE_LIMIT_ENABLED=true in .env to activate real limits.
 *
 * @author Puran
 * @created 2026-04-03
 * @module Shared - Rate Limiting
 */
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === "true";

const noopLimiter = {
  async limit() {
    return { success: true, reset: 0, limit: 0, remaining: 0, pending: Promise.resolve() };
  },
};

/**
 * Creates an Upstash Redis client if env vars are set, otherwise returns null.
 *
 * @returns Redis client or null
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Rate Limiting
 */
function createRedis() {
  if (!RATE_LIMIT_ENABLED) return null;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return new Redis({ url, token });
  }

  if (process.env.NEXT_PHASE !== "phase-production-build") {
    logger.warn("Upstash not configured — using in-memory limiters", {
      route: "rate-limit/init",
    });
  }
  return null;
}

const redis = createRedis();

const HOUR_MS = 60 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

// When disabled, all limiters are no-ops (always allow)
// When enabled, use Redis if available, otherwise in-memory fallback

/** Signup: 5 requests per hour per IP */
export const signupLimiter = !RATE_LIMIT_ENABLED
  ? noopLimiter
  : redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "rl:signup", analytics: false })
    : createMemorySlidingWindow(5, HOUR_MS);

/** Verify email: 10 requests per 15 minutes per key (IP or email) */
export const verifyEmailLimiter = !RATE_LIMIT_ENABLED
  ? noopLimiter
  : redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "15 m"), prefix: "rl:verify-email", analytics: false })
    : createMemorySlidingWindow(10, FIFTEEN_MIN_MS);

/** Resend OTP: 1 request per 60 seconds per email (cooldown) */
export const resendCooldownLimiter = !RATE_LIMIT_ENABLED
  ? noopLimiter
  : redis
    ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(1, "60 s"), prefix: "rl:resend-cooldown", analytics: false })
    : createMemoryCooldown(60 * 1000);

/** Resend OTP: 5 requests per hour per email (hourly cap) */
export const resendHourlyLimiter = !RATE_LIMIT_ENABLED
  ? noopLimiter
  : redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "rl:resend-hourly", analytics: false })
    : createMemorySlidingWindow(5, HOUR_MS);

/** Login: 10 requests per 15 minutes per key (IP or email) */
export const loginLimiter = !RATE_LIMIT_ENABLED
  ? noopLimiter
  : redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "15 m"), prefix: "rl:login", analytics: false })
    : createMemorySlidingWindow(10, FIFTEEN_MIN_MS);

/** Forgot password: 3 requests per 15 minutes per key (IP or email) */
export const forgotPasswordLimiter = !RATE_LIMIT_ENABLED
  ? noopLimiter
  : redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "15 m"), prefix: "rl:forgot-password", analytics: false })
    : createMemorySlidingWindow(3, FIFTEEN_MIN_MS);

/** Reset password: 5 requests per 15 minutes per IP */
export const resetPasswordLimiter = !RATE_LIMIT_ENABLED
  ? noopLimiter
  : redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "15 m"), prefix: "rl:reset-password", analytics: false })
    : createMemorySlidingWindow(5, FIFTEEN_MIN_MS);

/**
 * OAuth establish: 10 requests per 15 minutes per IP.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - OAuth Rate Limiting
 */
export const oauthEstablishLimiter = !RATE_LIMIT_ENABLED
  ? noopLimiter
  : redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "15 m"), prefix: "rl:oauth-establish", analytics: false })
    : createMemorySlidingWindow(10, FIFTEEN_MIN_MS);
