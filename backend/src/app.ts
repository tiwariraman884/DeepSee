/**
 * Express app factory — the single source of middleware and routes.
 *
 * Two entrypoints consume it:
 *   - src/server.ts  — the long-running server (`npm run dev`, Docker). It adds
 *     listen() plus the background pipeline (ML workers, species classifier,
 *     sensor pipeline).
 *   - this file's default export — the Vercel `backend` service. Vercel's
 *     Express preset loads `src/app.ts` and expects a default export of the app
 *     (or an `app.listen` call); server.ts calls listen() and exports nothing,
 *     so it cannot be the service entrypoint.
 *
 * What a serverless function cannot own, and where it lives instead:
 *   - the ML models: the `ml` service, reached over the ML_URL binding (see
 *     lib/mlService.ts). mlWorker/speciesWorker/routes switch to HTTP when set.
 *   - the ESP32 → EventBus → drone pipeline: the backend function is stateless
 *     and scaled to zero, so there is no single process to feed. Sensor data
 *     reaches it through POST /api/sensors/ingest.
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import helmet from "helmet";

// Loads the repo-root .env first (see src/server.ts for why this import order matters).
import "./lib/env";

import { assertSafeProductionAuth } from "./lib/authMiddleware";
import { rateLimit } from "./lib/rateLimit";

import authRoutes from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import analyticsRoutes from "./routes/analytics";
import dronesRoutes from "./routes/drones";
import pollutionRoutes from "./routes/pollution";
import speciesRoutes from "./routes/species";
import sensorsRoutes from "./routes/sensors";
import missionsRoutes from "./routes/missions";
import reportsRoutes from "./routes/reports";
import settingsRoutes from "./routes/settings";
import alertsRoutes from "./routes/alerts";
import demoRoutes from "./routes/demo";
import systemRoutes from "./routes/system";
import visionRoutes from "./routes/vision";

export function createApp() {
  // Fail fast if the process was pointed at test mode outside a real Jest run —
  // see assertSafeProductionAuth(). A startup guard, not a per-request check.
  assertSafeProductionAuth();

  const app = express();

  app.use(helmet());
  // Same-origin: the frontend is served from the same domain and proxies /api here.
  const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  app.use(cors({ origin: allowedOrigin, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, "../public")));

  // API responses are live data; no-store stops the browser revalidating to 304,
  // which client fetches treat as a failure and leave the dashboard stale.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // ─── Rate Limiting ─────────────────────────────────────────────────────────
  const apiLimiter = rateLimit(100, 60_000); // 100 requests per minute per IP
  app.use("/api/", (req, res, next) => {
    // Long-lived SSE streams hold one connection open for minutes; counting
    // every (re)connect against the shared per-IP budget lets a reconnect burst
    // starve real API calls (e.g. demo scenario start → 429). Exempt them.
    if (req.path === "/sensors/stream" || req.path === "/sensors/live") return next();
    return apiLimiter(req, res, next);
  });

  // Distinct window name: a serverless instance boots on demand, so without it
  // the auth limiter's fresh counter would share the general API namespace (or,
  // worse, a call-order-dependent id) and be exhausted by the dashboard's own
  // requests. /me is fetched by both profile cards (twice more under StrictMode)
  // and /logout is not a guessing surface; limiting them at 5/min made normal
  // navigation answer 429 and look logged out.
  const authLimiter = rateLimit(5, 60_000, "auth"); // 5 requests per minute
  app.use(
    "/api/auth",
    (req, res, next) => {
      if (req.path === "/me" || req.path === "/logout") return next();
      return authLimiter(req, res, next);
    },
    authRoutes
  );
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/drones", dronesRoutes);
  app.use("/api/pollution", pollutionRoutes);
  app.use("/api/species", speciesRoutes);
  app.use("/api/sensors", sensorsRoutes);
  app.use("/api/missions", missionsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/alerts", alertsRoutes);
  app.use("/api/demo", demoRoutes);
  app.use("/api/system", systemRoutes);
  app.use("/api/vision", visionRoutes);

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    const { mlWorker } = require("./lib/mlWorker");
    const { sseManager } = require("./lib/sseManager");
    const { eventBus } = require("./lib/eventBus");
    res.json({
      status: "ok",
      uptime: process.uptime(),
      mlWorker: { ready: mlWorker.isReady() },
      sse: sseManager.getStats(),
      eventBus: eventBus.getStats(),
    });
  });

  // ─── 404 Handler ────────────────────────────────────────────────────────────
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // ─── Error Handler ──────────────────────────────────────────────────────────
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Server Error]", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

// Vercel's Express preset: the default export is the function handler.
export default createApp();
