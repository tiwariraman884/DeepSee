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

import { createApp } from "./app";
import { mlServiceEnabled } from "./lib/mlService";

// The Express app (middleware, routes, 404/error handlers, the
// assertSafeProductionAuth() startup guard) lives in app.ts so this entrypoint
// and the Vercel function entrypoint cannot drift apart. This file only adds
// what a long-running server owns: listen() and the background pipeline
// (ML workers, species classifier, sensor pipeline).
const app = createApp();
const PORT = process.env.PORT || 5000;

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
  console.log("[Boot] Step 2/3 — Preparing species classifier...");
  if (mlServiceEnabled()) {
    console.log("[Boot] Species classification delegated to the private ML service");
  } else {
    const { speciesWorker } = await import("./lib/speciesWorker");
    try {
      await speciesWorker.start();
    } catch (err: any) {
      console.warn("[Boot] Species classifier failed to start:", err.message);
      console.warn("[Boot] /api/species/classify will fall back to one-shot Python");
    }
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
