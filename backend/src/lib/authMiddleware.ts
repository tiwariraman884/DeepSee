/**
 * Authentication middleware for Express routes.
 * Supports both cookie-based sessions (existing) and API key auth (for programmatic access).
 */
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const DEV_FALLBACK_SECRET = "deepsea-guardian-very-secret-key-that-is-32-chars-long";
const SECRET = process.env.AUTH_SECRET || process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production" ? undefined : DEV_FALLBACK_SECRET);

if (!SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET must be set in production");
}

function b64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function fromB64url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function verifyToken(token: string): { id: string; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const [header, body, sig] = parts;
      const unsigned = `${header}.${body}`;
      const expectedSig = crypto.createHmac("sha256", SECRET!).update(unsigned).digest("base64url");
      if (sig !== expectedSig) return null;
      const payload = JSON.parse(fromB64url(body));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
      return { id: payload.id, role: payload.role };
    }
  } catch { /* invalid token */ }
  return null;
}

/**
 * Require authentication. Checks for:
 * 1. Bearer token in Authorization header (API clients)
 * 2. auth-token cookie (browser sessions)
 * 3. API key in X-API-Key header (programmatic access)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth in development/test if no secret is set
  if (!SECRET && process.env.NODE_ENV !== "production") {
    (req as any).user = { id: "dev-user", role: "admin" };
    return next();
  }

  // Skip auth in test environment (Jest sets NODE_ENV=test)
  if (process.env.NODE_ENV === "test") {
    (req as any).user = { id: "test-user", role: "admin" };
    return next();
  }

  // Check API key first
  const apiKey = req.headers["x-api-key"] as string;
  if (apiKey && apiKey === process.env.API_KEY) {
    (req as any).user = { id: "api-client", role: "service" };
    return next();
  }

  // Check Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const user = verifyToken(token);
    if (user) {
      (req as any).user = user;
      return next();
    }
  }

  // Check cookie
  const cookieToken = req.cookies?.["auth-token"] || req.cookies?.session_token;
  if (cookieToken) {
    const user = verifyToken(cookieToken);
    if (user) {
      (req as any).user = user;
      return next();
    }
  }

  res.status(401).json({ error: "Authentication required" });
}

/**
 * Require admin role. Must be used after requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

/**
 * Optional auth — attaches user if token present, but doesn't reject.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const user = verifyToken(authHeader.slice(7));
    if (user) (req as any).user = user;
  }
  if (!(req as any).user) {
    const cookieToken = req.cookies?.["auth-token"] || req.cookies?.session_token;
    if (cookieToken) {
      const user = verifyToken(cookieToken);
      if (user) (req as any).user = user;
    }
  }
  next();
}
