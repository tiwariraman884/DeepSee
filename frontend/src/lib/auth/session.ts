/**
 * Session token utilities
 *
 * Uses a simple HMAC-SHA256 signed JSON payload instead of adding a full
 * JWT library. The token is stored as an HttpOnly cookie and validated
 * server-side by the middleware and /api/auth/me.
 *
 * Structure:  base64url(header).base64url(payload).base64url(signature)
 */

import crypto from "crypto";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const SESSION_COOKIE_NAME = "auth-token";

export const SESSION_COOKIE_OPTIONS: Partial<ResponseCookie> = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export interface SessionPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is not set");
  return secret;
}

function b64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function fromB64url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

export function createSessionToken(payload: Omit<SessionPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const full: SessionPayload = { ...payload, iat: now, exp: now + 60 * 60 * 24 * 7 };

  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(full));
  const unsigned = `${header}.${body}`;

  const sig = crypto.createHmac("sha256", getSecret()).update(unsigned).digest("base64url");
  return `${unsigned}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    const unsigned = `${header}.${body}`;
    const expectedSig = crypto.createHmac("sha256", getSecret()).update(unsigned).digest("base64url");

    // Constant-time comparison
    if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expectedSig, "base64url"))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(fromB64url(body));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null; // expired

    return payload;
  } catch {
    return null;
  }
}
