const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;

const attempts = new Map<string, { count: number; reset: number }>();

export function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = attempts.get(identifier);
  if (!entry || now > entry.reset) {
    attempts.set(identifier, { count: 1, reset: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

export function validateCsrf(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.hostname === host;
  } catch {
    return false;
  }
}
