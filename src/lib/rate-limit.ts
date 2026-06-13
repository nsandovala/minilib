/**
 * Simple in-memory rate limiter for API routes.
 * Uses sliding window per IP address.
 *
 * NOTE: In-memory stores reset on each deployment/function cold start.
 * For production with high traffic, replace with Redis or Upstash.
 */

interface RateLimitEntry {
  requests: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
const CLEANUP_INTERVAL_MS = 60_000;

if (typeof globalThis !== 'undefined') {
  // Only run cleanup in Node.js environment (not browser)
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const key of Array.from(store.keys())) {
      const entry = store.get(key);
      if (entry && entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Prevent cleanup from keeping process alive in tests
  if (cleanup.unref) {
    cleanup.unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  identifier: string,
  options: {
    windowMs: number;
    maxRequests: number;
  } = { windowMs: 60_000, maxRequests: 20 }
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + options.windowMs;
    store.set(identifier, { requests: 1, resetAt });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt,
    };
  }

  // Within window
  if (entry.requests >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.requests += 1;
  return {
    allowed: true,
    remaining: options.maxRequests - entry.requests,
    resetAt: entry.resetAt,
  };
}
