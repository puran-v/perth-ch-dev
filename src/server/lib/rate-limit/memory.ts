// Author: Puran
// Impact: in-memory rate limiter fallback for local dev without Redis
// Reason: allows `npm run dev` without Upstash; not for production use

/**
 * Creates an in-process sliding-window rate limiter for local dev
 * when Upstash Redis is not configured. Each identifier (IP, email)
 * gets its own timestamp bucket. Not suitable for multi-instance production.
 *
 * @param max - Maximum requests allowed within the window
 * @param windowMs - Window duration in milliseconds
 * @returns Limiter object with `.limit(identifier)` matching Upstash interface
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Rate Limiting
 */
export function createMemorySlidingWindow(max: number, windowMs: number) {
  const buckets = new Map<string, number[]>();

  return {
    async limit(identifier: string) {
      const now = Date.now();
      let timestamps = buckets.get(identifier) ?? [];
      timestamps = timestamps.filter((t) => now - t < windowMs);

      if (timestamps.length >= max) {
        const reset = timestamps[0]! + windowMs;
        return {
          success: false,
          reset,
          limit: max,
          remaining: 0,
          pending: Promise.resolve(),
        };
      }

      timestamps.push(now);
      buckets.set(identifier, timestamps);
      const reset = timestamps[0]! + windowMs;

      return {
        success: true,
        reset,
        limit: max,
        remaining: max - timestamps.length,
        pending: Promise.resolve(),
      };
    },
  };
}

/**
 * Creates a fixed-cooldown limiter allowing at most one request per interval
 * per identifier. Used for resend-OTP cooldown (1 per 60s).
 *
 * @param intervalMs - Cooldown duration in milliseconds
 * @returns Limiter object with `.limit(identifier)` matching Upstash interface
 *
 * @author Puran
 * @created 2026-04-02
 * @module Shared - Rate Limiting
 */
export function createMemoryCooldown(intervalMs: number) {
  const nextAllowedAt = new Map<string, number>();

  return {
    async limit(identifier: string) {
      const now = Date.now();
      const until = nextAllowedAt.get(identifier) ?? 0;

      if (now < until) {
        return {
          success: false,
          reset: until,
          limit: 1,
          remaining: 0,
          pending: Promise.resolve(),
        };
      }

      const reset = now + intervalMs;
      nextAllowedAt.set(identifier, reset);

      return {
        success: true,
        reset,
        limit: 1,
        remaining: 0,
        pending: Promise.resolve(),
      };
    },
  };
}
