import type { Redis } from 'ioredis'

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetInSec: number
}

/**
 * Fixed-window rate limiter backed by Redis.
 *
 * `failClosed` controls behaviour when Redis is unavailable:
 * - false (default): allow the request (availability over strictness) for
 *   non-security-critical paths.
 * - true: reject the request. Use this for authentication and other
 *   security-sensitive endpoints where failing open is unacceptable.
 */
export async function checkRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSec: number,
  opts?: { failClosed?: boolean },
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowKey = `ratelimit:${key}:${Math.floor(now / (windowSec * 1000))}`
  try {
    const count = await redis.incr(windowKey)
    if (count === 1) {
      // Only the first increment in a window sets the TTL; refresh if missing.
      const ttl = await redis.ttl(windowKey)
      if (ttl < 0) await redis.expire(windowKey, windowSec)
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetInSec: windowSec,
    }
  } catch {
    if (opts?.failClosed) {
      return { allowed: false, remaining: 0, resetInSec: windowSec }
    }
    return { allowed: true, remaining: limit, resetInSec: windowSec }
  }
}
