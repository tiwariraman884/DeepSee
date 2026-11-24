import withBundleAnalyzer from "@next/bundle-analyzer";

/**
 * Backend origin for the local Docker Compose proxy.
 *
 * Hardcoding http://localhost:5000 broke Docker Compose: inside the frontend
 * container "localhost" is the frontend itself, so every /api/* call failed
 * with ECONNREFUSED (seen in dev-frontend-err.log). Resolution order:
 *   1. BACKEND_URL          — server-side, set by compose to http://backend:5000
 *   2. NEXT_PUBLIC_API_URL  — existing public variable, still honoured
 *   3. null                 — no proxy rule
 * Trailing slashes are stripped because the destination appends /api/:path*.
 *
 * Vercel Services: the root vercel.json routes /api/* (and every page) before
 * this app sees a request, and the top-level rewrites are the only public
 * routing. So no proxy is added when VERCEL=1 — a rewrite here would sit in
 * front of the service route and send the browser's same-origin /api/* calls
 * to whatever BACKEND_URL happens to be (a binding, or localhost in a build).
 * Local testing of the full stack is `vercel dev --local` from the repo root;
 * plain `next dev` still proxies to BACKEND_URL for backend-only work.
 */
function resolveBackendUrl() {
  const configured = process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (process.env.VERCEL === "1") return null;
  return (configured || "http://localhost:5000").replace(/\/+$/, "");
}

const BACKEND_URL = resolveBackendUrl();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 768, 1024, 1280, 1536],
    imageSizes: [128, 256, 384, 512],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    dangerouslyAllowSVG: false,
  },
  devIndicators: {
    staticRoutesIndicator: false,
  },
  // Public /api routing belongs to root Vercel Services rewrites.
  // Use "vercel dev --local" from the repository root for local testing.
  async rewrites() {
    if (!BACKEND_URL) return [];
    return [
      {
        source: "/api/assistant",
        // Implemented in this app (app/api/assistant/route.ts). It must NOT be
        // forwarded to the Express backend, which has no such route.
        destination: "/api/assistant",
      },
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default bundleAnalyzer(nextConfig);
