/**
 * Vercel Express entrypoint for the `backend` service.
 *
 * Vercel's Express preset loads the app from `src/app.ts` (app/index/server at
 * the service root or under src/) and expects either a default export or an
 * `app.listen` call. `src/server.ts` — the normal entrypoint for `npm run dev`
 * and containers — builds the app inline, starts three long-lived workers, and
 * calls listen(), so it is not importable as a function handler. This file
 * mounts the exact same router table and returns the app instead.
 *
 * What a serverless function cannot own, and where it lives instead:
 *   - the ML models: the `ml` service, reached over the ML_SERVICE_URL binding
 *     (see lib/mlService.ts). mlWorker/speciesWorker switch to HTTP when it is set.
 *   - the ESP32 → EventBus → drone pipeline: the backend function is stateless
 *     and scaled to zero, so there is no single process to feed. Sensor data
 *     reaches it through POST /api/sensors/ingest.
 *
 * Keep the route list below in sync with src/server.ts. The auth/api rate
 * limiters are shared with server.ts so both entrypoints behave identically.
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

assertSafeProductionAuth();

const app = express();

app.use(helmet());
// Same-origin: the frontend is served from the same domain and proxies /api here.
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const apiLimiter = rateLimit(100, 60_000);
app.use("/api/", (req, res, next) => {
  // SSE streams hold a connection open; exempt them from the per-IP budget.
  if (req.path === "/sensors/stream" || req.path === "/sensors/live") return next();
  return apiLimiter(req, res, next);
});

// Distinct window namespace: a serverless instance boots on demand, so without
// this the auth limiter's fresh counter would share the general API namespace
// and be exhausted by the dashboard's own requests.
const authLimiter = rateLimit(5, 60_000, "auth");
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

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
