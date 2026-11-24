/**
 * In-memory fixed-window rate limiter for Next.js route handlers.
 *
 * Mirrors backend/src/lib/rateLimit.ts (same semantics: fixed window, Retry-After
 * on rejection) but keyed by client address derived from the Next `Request`,
 * since route handlers have no Express `req.ip`.
 *
 * Scope: single process, like the backend limiter. A multi-instance deployment
 * needs a shared store (Redis) before these limits can be relied upon; that is
 * recorded as an unresolved risk rather than papered over here.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

export interface RateLimitBroker {
  /** True if this call is within budget. */
  hit(key: string): boolean;
  /** Seconds until the current window resets (for Retry-After). */
  retryAfter(key: string): number;
}

export function createRateLimiter(maxRequests: number, windowMs: number): RateLimitBroker {
  const namespace = Math.random().toString(36).slice(2, 8);

  function current(bucketKey: string) {
    const now = Date.now();
    let win = buckets.get(bucketKey);
    if (!win || win.resetAt <= now) {
      win = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, win);
    }
    return win;
  }

  function prune() {
    const now = Date.now();
    for (const [key, win] of buckets) {
      if (win.resetAt <= now) buckets.delete(key);
    }
  }

  return {
    hit(key: string): boolean {
      // Opportunistic cleanup keeps the map bounded without a background timer
      // (a module-scope setInterval would hold the process open during builds).
      if (buckets.size > 1000) prune();
      const win = current(`${namespace}:${key}`);
      win.count += 1;
      return win.count <= maxRequests;
    },
    retryAfter(key: string): number {
      const win = buckets.get(`${namespace}:${key}`);
      if (!win) return 0;
      return Math.max(0, Math.ceil((win.resetAt - Date.now()) / 1000));
    },
  };
}

/**
 * Client identity for rate limiting.
 *
 * Uses the platform-provided client address when present. Forwarded headers are
 * deliberately NOT consulted: they are client-controlled unless a trusted proxy
 * is configured, which would let a caller rotate through the header to bypass
 * the limit entirely.
 */
export function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-real-ip");
  if (forwardedFor) return forwardedFor.trim();
  // Next populates this on the underlying request in most hosting environments.
  const raw = request as unknown as { ip?: string };
  if (typeof raw.ip === "string" && raw.ip) return raw.ip;
  return "unknown";
}