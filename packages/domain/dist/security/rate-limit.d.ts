import type { Redis } from 'ioredis';
export type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    resetInSec: number;
};
/**
 * Fixed-window rate limiter backed by Redis.
 *
 * `failClosed` controls behaviour when Redis is unavailable:
 * - false (default): allow the request (availability over strictness) for
 *   non-security-critical paths.
 * - true: reject the request. Use this for authentication and other
 *   security-sensitive endpoints where failing open is unacceptable.
 */
export declare function checkRateLimit(redis: Redis, key: string, limit: number, windowSec: number, opts?: {
    failClosed?: boolean;
}): Promise<RateLimitResult>;
//# sourceMappingURL=rate-limit.d.ts.map