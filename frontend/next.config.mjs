import withBundleAnalyzer from "@next/bundle-analyzer";

/**
 * Backend origin for the /api proxy.
 *
 * Hardcoding http://localhost:5000 broke Docker Compose: inside the frontend
 * container "localhost" is the frontend itself, so every /api/* call failed
 * with ECONNREFUSED (seen in dev-frontend-err.log). Resolution order:
 *   1. BACKEND_URL          — server-side, set by compose to http://backend:5000
 *   2. NEXT_PUBLIC_API_URL  — existing public variable, still honoured
 *   3. http://localhost:5000 — local development default
 * Trailing slashes are stripped because the destination appends /api/:path*.
 */
function resolveBackendUrl() {
  const configured = process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
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
  async rewrites() {
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
