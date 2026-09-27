import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));

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

app.use("/api/auth",      authRoutes);
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

// ─── Server startup — Wire up the full pipeline ───────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🌊 DeepSea Guardian Backend — http://localhost:${PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Step 1: Start ML Worker (loads model into RAM)
  console.log("[Boot] Step 1/3 — Starting ML Inference Worker...");
  const { mlWorker } = await import("./lib/mlWorker");
  try {
    await mlWorker.start();
    console.log("[Boot] ✅ ML Worker ready — model in RAM, ~1-5ms predictions");
  } catch (err: any) {
    console.warn("[Boot] ⚠️  ML Worker failed to start:", err.message);
    console.warn("[Boot]     Predictions will fall back to spawning Python per-request");
  }

  // Step 2: Warm the species classifier so the first user request is fast.
  // Loading torch + the checkpoint takes ~40s cold; doing it at boot keeps the
  // request path well inside the frontend proxy timeout.
  console.log("[Boot] Step 2/3 — Warming species classifier...");
  const { speciesWorker } = await import("./lib/speciesWorker");
  try {
    await speciesWorker.start();
  } catch (err: any) {
    console.warn("[Boot] ⚠️  Species classifier failed to start:", err.message);
    console.warn("[Boot]     /api/species/classify will fall back to one-shot Python");
  }

  // Step 3: Initialize Sensor Data Pipeline (EventBus workers)
  console.log("[Boot] Step 3/3 — Initializing Sensor Data Pipeline...");
  const { initSensorPipeline } = await import("./lib/sensorPipeline");
  initSensorPipeline();
  console.log("[Boot] ✅ Sensor pipeline active — EventBus → ML → SQLite WAL → SSE");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📡 SSE Stream:     GET  /api/sensors/stream");
  console.log("🤖 ML Predict:     POST /api/sensors/predict");
  console.log("📥 Data Ingest:    POST /api/sensors/ingest");
  console.log("📊 Pipeline Stats: GET  /api/sensors/pipeline-stats");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
