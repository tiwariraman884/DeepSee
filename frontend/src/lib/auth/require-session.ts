/**
 * Server-side session gate for route handlers that are not proxied to the
 * backend (e.g. /api/assistant).
 *
 * Uses the same HMAC-verified token and cookie name as the rest of the app
 * (src/lib/auth/session.ts, written by the backend login flow). This is a real
 * signature + expiry check — NOT the presence-only check in middleware.ts, and
 * there is no bypass of any kind: no NODE_ENV branch, no test shortcut, no
 * "if secret missing, allow through". A missing secret fails closed.
 */
import { verifySessionToken, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/auth/session";

export type SessionCheck =
  | { ok: true; user: SessionPayload }
  | { ok: false; status: 401; error: string };

/** Parse one cookie value out of a raw Cookie header. */
export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    const value = part.slice(eq + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export function requireSession(request: Request): SessionCheck {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (!token) return { ok: false, status: 401, error: "Authentication required" };
  const user = verifySessionToken(token);
  if (!user) return { ok: false, status: 401, error: "Invalid or expired session" };
  return { ok: true, user };
}