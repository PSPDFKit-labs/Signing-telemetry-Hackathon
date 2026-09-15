import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Returns an Upstash Redis-backed rate limiter if configured, or null if
 * the required environment variables are missing (e.g., local dev).
 */
function createRatelimit(
  requests: number,
  window: `${number} s` | `${number} m` | `${number} h`,
  prefix: string,
): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `ratelimit:${prefix}`,
  });
}

/** Specific rate limiters — null when Upstash is not configured */
export const uploadLimiter = createRatelimit(10, '1 m', 'upload');
export const sendLimiter = createRatelimit(5, '1 m', 'send');
export const signLimiter = createRatelimit(10, '1 m', 'sign');
export const generalLimiter = createRatelimit(60, '1 m', 'general');

/** Route prefix -> limiter mapping (order matters — first match wins) */
const ROUTE_LIMITERS: [string, Ratelimit | null][] = [
  ['/api/upload', uploadLimiter],
  ['/api/documents/proxy', generalLimiter], // proxy serves PDF data — needs generous limit
  ['/api/documents/', sendLimiter],
  ['/api/sign/submit', signLimiter],
];

/**
 * Get the appropriate rate limiter for a given pathname.
 * Returns the most specific match, falling back to the general limiter.
 */
export function getLimiterForRoute(pathname: string): Ratelimit | null {
  for (const [prefix, limiter] of ROUTE_LIMITERS) {
    if (pathname.startsWith(prefix)) return limiter;
  }
  return generalLimiter;
}
