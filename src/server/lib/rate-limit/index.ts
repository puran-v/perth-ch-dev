/**
 * Rate limiter factory — Upstash Redis in production, in-memory fallback for dev.
 *
 * Each limiter is configured per route with specific windows and limits.
 * All limiters expose a `.limit(key)` method returning `{ success, reset }`.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Rate Limiting
 */

// Author: Puran
// Impact: rate limiters for all auth routes (signup, verify, resend, login, forgot, reset)
// Reason: prevent abuse on expensive operations (bcrypt, DB writes, email sends)

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createMemoryCooldown, createMemorySlidingWindow } from "./memory";
import { logger } from "@/server/lib/logger";

/**
 * Creates an Upstash Redis client if env vars are set, otherwise returns null
 * and logs a warning. Null triggers in-memory fallback for each limiter.
 *
 * @returns Redis client or null
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Rate Limiting
 */
function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return new Redis({ url, token });
  }

  logger.warn("Upstash not configured — using in-memory limiters (dev only)", {
    route: "rate-limit/init",
  });
  return null;
}

const redis = createRedis();

const HOUR_MS = 60 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/**
 * Signup: 5 requests per hour per IP
 */
export const signupLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "rl:signup",
      analytics: false,
    })
  : createMemorySlidingWindow(5, HOUR_MS);

/**
 * Verify email: 10 requests per 15 minutes per key (IP or email)
 */
export const verifyEmailLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      prefix: "rl:verify-email",
      analytics: false,
    })
  : createMemorySlidingWindow(10, FIFTEEN_MIN_MS);

/**
 * Resend OTP: 1 request per 60 seconds per email (cooldown)
 */
export const resendCooldownLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(1, "60 s"),
      prefix: "rl:resend-cooldown",
      analytics: false,
    })
  : createMemoryCooldown(60 * 1000);

/**
 * Resend OTP: 5 requests per hour per email (hourly cap)
 */
export const resendHourlyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "rl:resend-hourly",
      analytics: false,
    })
  : createMemorySlidingWindow(5, HOUR_MS);

/**
 * Login: 10 requests per 15 minutes per key (IP or email)
 */
export const loginLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      prefix: "rl:login",
      analytics: false,
    })
  : createMemorySlidingWindow(10, FIFTEEN_MIN_MS);

/**
 * Forgot password: 3 requests per 15 minutes per key (IP or email)
 */
export const forgotPasswordLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "15 m"),
      prefix: "rl:forgot-password",
      analytics: false,
    })
  : createMemorySlidingWindow(3, FIFTEEN_MIN_MS);

/**
 * Reset password: 5 requests per 15 minutes per IP
 */
export const resetPasswordLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "rl:reset-password",
      analytics: false,
    })
  : createMemorySlidingWindow(5, FIFTEEN_MIN_MS);

/**
 * OAuth establish: 10 requests per 15 minutes per IP
 * Prevents abuse of the OAuth-to-session bridge endpoint.
 *
 * @author Puran
 * @created 2026-04-02
 * @module Auth - OAuth Rate Limiting
 */
export const oauthEstablishLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      prefix: "rl:oauth-establish",
      analytics: false,
    })
  : createMemorySlidingWindow(10, FIFTEEN_MIN_MS);
