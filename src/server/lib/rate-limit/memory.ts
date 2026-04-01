/**
 * In-process sliding-window limiter for local dev when Upstash is not configured.
 * Not suitable for multi-instance production (use Redis-backed Ratelimit instead).
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

/** At most one successful check per `intervalMs` per identifier (fixed cooldown). */
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
