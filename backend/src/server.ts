import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import helmet from "helmet";

// ─── Environment bootstrap (MUST come first) ─────────────────────────────────
// This import has a side effect: it loads the repo-root .env into
// process.env. It MUST be the first import in this file.
//
// In this codebase the backend compiles to CommonJS, so every `import`
// statement becomes a `require()` emitted at the top of the module, ahead of
// all other statements. A `dotenv.config()` call placed in the middle of the
// import block therefore ran AFTER the modules it was meant to configure had
// already been evaluated — and `lib/authMiddleware.ts` validates AUTH_SECRET
// at module scope, so the backend crashed on startup with
// "AUTH_SECRET or SESSION_SECRET must be set".
//
// Importing the bootstrap module first guarantees dotenv has run before any
// other module body executes. See src/lib/env.ts for the full explanation.
import "./lib/env";

import { assertSafeProductionAuth } from "./lib/authMiddleware";

// Fail fast if the process was pointed at test mode outside a real Jest run —
// see assertSafeProductionAuth(). This is a startup guard, not a per-request check.
assertSafeProductionAuth();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
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

// ─── Rate Limiting ───────────────────────────────────────────────────────────
import { rateLimit } from "./lib/rateLimit";
const apiLimiter = rateLimit(100, 60_000); // 100 requests per minute per IP
app.use("/api/", (req, res, next) => {
  // Long-lived SSE streams hold one connection open for minutes; counting
  // every (re)connect against the shared per-IP budget lets a reconnect burst
  // starve real API calls (e.g. demo scenario start → 429). Exempt them.
  if (req.path === "/sensors/stream" || req.path === "/sensors/live") return next();
  return apiLimiter(req, res, next);
});

// ─── Routes ───────────────────────────────────────────────────────────────────
import authRoutes      from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import analyticsRoutes from "./routes/analytics";
import dronesRoutes    from "./routes/drones";
import pollutionRoutes from "./routes/pollution";
import speciesRoutes   from "./routes/species";
import sensorsRoutes   from "./routes/sensors";
import missionsRoutes  from "./routes/missions";
import reportsRoutes   from "./routes/reports";
import settingsRoutes  from "./routes/settings";
import alertsRoutes    from "./routes/alerts";
import demoRoutes       from "./routes/demo";
import systemRoutes     from "./routes/system";
import visionRoutes     from "./routes/vision";

const authLimiter = rateLimit(5, 60_000, "auth"); // 5 requests per minute for credential endpoints
// /me is fetched by both profile cards (twice more under StrictMode) and
// /logout is not a guessing surface; limiting them at 5/min made normal
// navigation answer 429 and look logged out.
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
app.use("/api/drones",    dronesRoutes);
app.use("/api/pollution", pollutionRoutes);
app.use("/api/species",   speciesRoutes);
app.use("/api/sensors",   sensorsRoutes);
app.use("/api/missions",  missionsRoutes);
app.use("/api/reports",   reportsRoutes);
app.use("/api/settings",  settingsRoutes);
app.use("/api/alerts",    alertsRoutes);
app.use("/api/demo",      demoRoutes);
app.use("/api/system",    systemRoutes);
app.use("/api/vision",    visionRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  const { mlWorker }  = require("./lib/mlWorker");
  const { sseManager } = require("./lib/sseManager");
  const { eventBus }  = require("./lib/eventBus");
  res.json({
    status:   "ok",
    uptime:   process.uptime(),
    mlWorker: { ready: mlWorker.isReady() },
    sse:      sseManager.getStats(),
    eventBus: eventBus.getStats(),
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Server startup — Wire up the full pipeline ───────────────────────────────
app.listen(PORT, async () => {
  console.log(`\nDeepSea Guardian Backend — http://localhost:${PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Step 1: Start ML Worker (loads model into RAM)
  console.log("[Boot] Step 1/3 — Starting ML Inference Worker...");
  const { mlWorker } = await import("./lib/mlWorker");
  try {
    await mlWorker.start();
    console.log("[Boot] ML Worker ready — model in RAM, ~1-5ms predictions");
  } catch (err: any) {
    console.warn("[Boot] ML Worker failed to start:", err.message);
    console.warn("[Boot] Predictions will fall back to spawning Python per-request");
  }

  // Step 2: Warm the species classifier
  console.log("[Boot] Step 2/3 — Warming species classifier...");
  const { speciesWorker } = await import("./lib/speciesWorker");
  try {
    await speciesWorker.start();
  } catch (err: any) {
    console.warn("[Boot] Species classifier failed to start:", err.message);
    console.warn("[Boot] /api/species/classify will fall back to one-shot Python");
  }

  // Step 3: Initialize Sensor Data Pipeline
  console.log("[Boot] Step 3/3 — Initializing Sensor Data Pipeline...");
  const { initSensorPipeline } = await import("./lib/sensorPipeline");
  initSensorPipeline();
  console.log("[Boot] Sensor pipeline active — Consumer → Dispatcher → Inspector");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SSE Stream:     GET  /api/sensors/stream");
  console.log("ML Predict:     POST /api/sensors/predict");
  console.log("Data Ingest:    POST /api/sensors/ingest");
  console.log("Pipeline Stats: GET  /api/sensors/pipeline-stats");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
