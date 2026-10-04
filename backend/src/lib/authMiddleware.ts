/**
 * Authentication middleware for Express routes.
 * Supports both cookie-based sessions (existing) and API key auth (for programmatic access).
 *
 * ── Test-only auth bypass ──────────────────────────────────────────────────────
 * The test suite mounts real routers (demo.ts, settings.ts, …) that sit behind
 * requireAuth/requireAdmin, and drives them over supertest without minting real
 * JWTs. A bypass exists so those suites exercise routing/business logic rather
 * than re-implementing token minting.
 *
 * It is NOT gated on NODE_ENV alone. NODE_ENV is operator-controlled, so
 * `NODE_ENV=test` in a deployed container would otherwise disable
 * authentication entirely. It requires ALL of:
 *   1. NODE_ENV === "test", AND
 *   2. JEST_WORKER_ID is defined — Jest sets this per worker process, so it is
 *      only present inside an actual test run and cannot be set by accident
 *      through a compose/env file in normal operation, AND
 *   3. ALLOW_TEST_AUTH_BYPASS === "true" — an explicit, separate opt-in so a
 *      stray NODE_ENV=test alone is never sufficient.
 *
 * Production never satisfies these: a production server has no JEST_WORKER_ID
 * and the opt-in is absent, so it always performs real JWT verification.
 * See assertSafeProductionAuth() below, which refuses to boot under an unsafe
 * combination.
 */
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || process.env.SESSION_SECRET;

if (!SECRET) {
  throw new Error("AUTH_SECRET or SESSION_SECRET must be set");
}

function b64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function fromB64url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

/**
 * True only inside a genuine Jest worker that explicitly opted in.
 * Requires JEST_WORKER_ID (set by Jest per worker, absent in any real server)
 * in addition to NODE_ENV=test, so NODE_ENV alone can never disable auth.
 */
function testAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.JEST_WORKER_ID !== undefined &&
    process.env.ALLOW_TEST_AUTH_BYPASS === "true"
  );
}

/**
 * Refuse to boot when authentication could be silently disabled.
 *
 * NODE_ENV=test on a server that is NOT running under Jest means someone has
 * pointed a real deployment at test mode. Under the old NODE_ENV-only check
 * that single variable disabled authentication for every route. Now it can
 * only disable auth inside Jest, so this is a hard startup error rather than a
 * silent downgrade. Fail closed — do not convert this to a warning.
 */
export function assertSafeProductionAuth(): void {
  if (process.env.NODE_ENV !== "test") return;
  if (testAuthBypassEnabled()) return;
  throw new Error(
    "Refusing to start: NODE_ENV=test without an active Jest worker and " +
      "ALLOW_TEST_AUTH_BYPASS=true. Setting NODE_ENV=test on a real " +
      "deployment would disable authentication. Use NODE_ENV=production."
  );
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
  // Test-only bypass — see the header note. Requires a real Jest worker AND an
  // explicit opt-in; NODE_ENV=test by itself falls through to real JWT checks.
  if (testAuthBypassEnabled()) {
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
  // Test-only bypass — see the header note.
  if (testAuthBypassEnabled()) {
    (req as any).user = { id: "test-user", role: "admin" };
    return next();
  }
  
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
