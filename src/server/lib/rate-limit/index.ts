import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createMemoryCooldown, createMemorySlidingWindow } from "./memory";

function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return new Redis({ url, token });
  }

  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL / TOKEN not set — using in-memory limiters (dev / single-instance only)"
  );
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
