/**
 * System Intelligence API tests (Step 5).
 *
 *   A. Authenticated snapshot → 200 with services/operations/performance/models
 *   B. Unauthenticated request → 401
 *   C. Database health measured with a real lightweight query
 *   D. ML worker lifecycle states handled (ready/unavailable consistency)
 *   E. EventBus stats expose actual counters
 *   F. Rolling ML latency is recorded and bounded
 *   G. Model metrics originate from the repo's metric artifacts (not hard-coded)
 *
 * No pipeline/ML handles are opened by this suite.
 */
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";

import systemRoutes from "../routes/system";
import { eventBus, TOPICS } from "../lib/eventBus";
import {
  recordMlInferenceLatency,
  getMlInferenceStats,
  getMaxSamples,
  resetRuntimeMetricsForTests,
} from "../lib/runtimeMetrics";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/system", systemRoutes);

const ML_DIR = path.join(__dirname, "..", "..", "..", "ml");

describe("GET /api/system/intelligence", () => {
  it("A. returns 200 with all snapshot sections", async () => {
    const res = await request(app).get("/api/system/intelligence");
    expect(res.status).toBe(200);
    const b = res.body;
    expect(b.generatedAt).toBeTruthy();
    for (const key of ["services", "operations", "pipeline", "performance", "models"]) {
      expect(b[key]).toBeTruthy();
    }
    // Service blocks present with explicit statuses (no composite scores).
    expect(b.services.api.status).toBe("healthy");
    expect(typeof b.services.api.uptimeSeconds).toBe("number");
    expect(["healthy", "degraded"]).toContain(b.services.eventBus.status);
    expect(b.services.sse.clients).toBeGreaterThanOrEqual(0);
    // Operations counters are real numbers.
    expect(typeof b.operations.sensors.total).toBe("number");
    expect(typeof b.operations.drones.total).toBe("number");
    expect(typeof b.operations.inspections.total).toBe("number");
    expect(typeof b.operations.alerts.unresolved).toBe("number");
    expect(typeof b.operations.evidence.total).toBe("number");
  });

  it("B. rejects unauthenticated requests", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development"; // enforce real auth for this check
    try {
      const res = await request(app).get("/api/system/intelligence");
      expect(res.status).toBe(401);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("C. reports database health from a real lightweight query", async () => {
    const res = await request(app).get("/api/system/intelligence");
    expect(res.status).toBe(200);
    expect(res.body.services.database.status).toBe("healthy");
    expect(typeof res.body.services.database.latencyMs).toBe("number");
    expect(res.body.services.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.performance.database.queryLatencyMs).toBe("number");
  });

  it("D. reports ML worker lifecycle consistently", async () => {
    const res = await request(app).get("/api/system/intelligence");
    expect(res.status).toBe(200);
    const ml = res.body.services.mlWorker;
    expect(["ready", "starting", "unavailable"]).toContain(ml.status);
    // ready flag and lifecycle state must agree.
    expect(ml.ready).toBe(ml.status === "ready");
  });

  it("E. exposes actual EventBus counters", async () => {
    const before = await request(app).get("/api/system/intelligence");
    const bus = before.body.services.eventBus;
    for (const key of ["published", "delivered", "failed", "queueSize"]) {
      expect(typeof bus[key]).toBe("number");
    }
    eventBus.publish(TOPICS.SSE_BROADCAST, { ping: "intelligence-test" });
    const after = await request(app).get("/api/system/intelligence");
    expect(after.body.services.eventBus.published).toBeGreaterThanOrEqual(bus.published + 1);
  });

  it("F. records rolling ML latency with bounded storage", async () => {
    resetRuntimeMetricsForTests();
    recordMlInferenceLatency(10);
    recordMlInferenceLatency(20);
    recordMlInferenceLatency(30);
    let s = getMlInferenceStats();
    expect(s).toEqual({ currentMs: 30, averageMs: 20, minMs: 10, maxMs: 30, sampleCount: 3 });

    // Overflow the buffer — storage must stay bounded, newest value current.
    for (let i = 0; i < getMaxSamples() + 100; i++) recordMlInferenceLatency(5);
    s = getMlInferenceStats();
    expect(s.sampleCount).toBe(getMaxSamples());
    expect(s.currentMs).toBe(5);

    // The endpoint reflects the same rolling statistics (no stale snapshot).
    const res = await request(app).get("/api/system/intelligence");
    expect(res.body.pipeline.mlInference.sampleCount).toBe(getMaxSamples());
    resetRuntimeMetricsForTests();
  });

  it("G. serves model metrics from the repo artifacts", async () => {
    const anomalyArtifact = JSON.parse(
      fs.readFileSync(path.join(ML_DIR, "anomaly_validation_metrics.json"), "utf8")
    );
    const speciesArtifact = JSON.parse(
      fs.readFileSync(path.join(ML_DIR, "species_classifier_metrics.json"), "utf8")
    );

    const res = await request(app).get("/api/system/intelligence");
    expect(res.status).toBe(200);
    const { anomaly, species } = res.body.models;

    // Values must equal the artifact files — never hard-coded here.
    expect(anomaly.available).toBe(true);
    expect(anomaly.precision).toBe(anomalyArtifact.precision);
    expect(anomaly.recall).toBe(anomalyArtifact.recall);
    expect(anomaly.f1).toBe(anomalyArtifact.f1);
    expect(anomaly.evaluationType).toBe("synthetic-validation");

    expect(species.available).toBe(true);
    expect(species.validationAccuracy).toBe(speciesArtifact.validationAccuracy);
    expect(species.macroF1).toBe(speciesArtifact.macroF1);
    expect(species.validationSamples).toBe(speciesArtifact.validationSamples);
  });
});
