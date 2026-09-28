import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
const SESSION_COOKIE_NAME = "auth-token";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/about",
  "/mission",
  "/team",
  "/careers",
  "/contact",
  "/documentation",
  "/features",
  "/roadmap",
  "/blog",
  "/faq",
  "/privacy-policy",
  "/terms",
  "/cookie-policy",
  "/security",
  "/accessibility",
  "/help-center",
  "/report-issue",
  "/community",
  "/feedback",
  "/status",
];

// Lightweight token verification in Edge runtime (no Node crypto module import needed
// since Next.js middleware runs in the Edge runtime which has Web Crypto API).
// We do basic presence + expiry check here; full HMAC check is done in API routes.
function isValidToken(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return false;
    return typeof payload.id === "string" && payload.id.length > 0;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API auth routes & settings are always public
  if (pathname.startsWith("/api/auth/") || pathname === "/api/settings") {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (isPublic) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken || !isValidToken(sessionToken)) {
    // For API routes, return 401 instead of redirecting
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
