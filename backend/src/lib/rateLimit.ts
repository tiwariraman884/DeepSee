/**
 * Simple in-memory rate limiter middleware.
 * For production, replace with Redis-backed rate limiting.
 *
 * Serverless note (Vercel services): instances are created per request, so a
 * per-instance counter would reset on every invocation and limit nothing. Set
 * RATE_LIMIT_NAMESPACE to a constant that is identical across instances (e.g.
 * the deployment id) to share one key namespace per `name` (default "api");
 * leave it unset for local, Docker, and tests where each app instance keeps
 * its own counters.
 */
import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const clients = new Map<string, RateLimitEntry>();

// Each limiter instance gets its own counter namespace. Keying by IP alone made
// the 5/min auth limiter count every general API request, so one dashboard load
// exhausted it and /api/auth/me answered 429.
let nextLimiterId = 0;

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of clients) {
    if (entry.resetAt < now) {
      clients.delete(key);
    }
  }
}, 60_000);

export function rateLimit(maxRequests = 100, windowMs = 60_000, name?: string) {
  const namespace = process.env.RATE_LIMIT_NAMESPACE?.trim();
  const limiterId = namespace ? `${namespace}:${name ?? "api"}` : ++nextLimiterId;
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${limiterId}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const now = Date.now();

    let entry = clients.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      clients.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        error: "Too many requests",
        retryAfter,
      });
    }

    next();
  };
}
