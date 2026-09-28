/**
 * Sensor pipeline API tests — validation + end-to-end flow.
 *
 * The E2E test exercises the REAL pipeline: ingest → EventBus → ML predict →
 * alert → drone selection → inspection record. The inspection itself runs on
 * real timers in the server (not in tests), so the test asserts the synchronous
 * part of the chain and the persisted state, matching the demo flow:
 * sensor anomaly → alert → dispatch record (en_route) without DB manipulation.
 */
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

import sensorsRoutes from "../routes/sensors";
import {
  initSensorPipeline,
  resetActiveInspectionGuard,
  shutdownSensorPipelineForTests,
} from "../lib/sensorPipeline";
import { mlWorker } from "../lib/mlWorker";
import { sseManager } from "../lib/sseManager";
import { MIN_BATTERY_PCT } from "../lib/droneSelection";
import { getDb } from "../db";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/sensors", sensorsRoutes);

beforeAll(async () => {
  initSensorPipeline();
  // Warm the resident ML worker: the first spawn + model load takes ~5-8s,
  // which would blow the 5s default per-test timeout inside the first ingest.
  try { await mlWorker.ensureStarted(); } catch { /* predict tests will fail loudly */ }
}, 30000);

afterAll(async () => {
  // Full test-only teardown: clears every mission timer, releases the guard,
  // unsubscribes EventBus consumers, stops the SSE heartbeat and kills the
  // resident ML worker process — Jest can then exit without open handles.
  shutdownSensorPipelineForTests();
  sseManager.shutdownForTests();
  mlWorker.stop();
  // Give the OS a moment to reap the killed Python child and close its stdio
  // pipes — those handles otherwise keep the event loop alive briefly.
  await new Promise((r) => setTimeout(r, 500));
});

const VALID_READING = {
  sensorId: "sensor_001",
  sensorName: "Temp Station Alpha",
  temperature: 3.1,
  ph: 8.05,
  salinity: 34.5,
  oxygen: 5.2,
  turbidity: 0.4,
};

describe("POST /api/sensors/ingest", () => {
  it("accepts a valid reading (202 queued)", async () => {
    const res = await request(app).post("/api/sensors/ingest").send(VALID_READING);
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("queued");
    expect(res.body.sensorId).toBe(VALID_READING.sensorId);
  });

  it("rejects an invalid reading (missing sensorId)", async () => {
    const res = await request(app).post("/api/sensors/ingest").send({ ph: 8.0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("sensorId");
  });
});

describe("POST /api/sensors/predict", () => {
  it("rejects missing fields (invalid reading)", async () => {
    const res = await request(app).post("/api/sensors/predict").send({ temperature: 3.1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing fields");
  });

  it("classifies clean deep-sea water as normal (no anomaly)", async () => {
    const res = await request(app).post("/api/sensors/predict").send({
      temperature: 3.1, ph: 8.05, salinity: 34.5, oxygen: 5.2, turbidity: 0.4,
    });
    expect(res.status).toBe(200);
    expect(res.body.isAnomaly).toBe(false);
  });

  it("flags a chemical-spill reading as an anomaly (anomaly event generated)", async () => {
    const res = await request(app).post("/api/sensors/predict").send({
      temperature: 3.1, ph: 6.5, salinity: 34.5, oxygen: 2.1, turbidity: 12.0,
    });
    expect(res.status).toBe(200);
    expect(res.body.isAnomaly).toBe(true);
  });
});

describe("end-to-end: ingest → ML → alert → dispatch → inspection record", () => {
  it("persists an en_route inspection linked to a critical alert", async () => {
    const db = getDb();

    // ── Deterministic fleet state ────────────────────────────────────────────
    // Prior live sessions can leave every drone 'active', which suppresses
    // dispatch; ensure idle + eligible battery before the run.
    db.prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run();
    // An anomaly-predict in an earlier test starts a mission whose guard would
    // suppress this test's dispatch — release it deterministically.
    resetActiveInspectionGuard();

    const before = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;

    // ── Trigger the REAL chain through sensor ingestion ───────────────────
    // ingest → EventBus(sensor.reading) → mlWorker.predict → anomaly →
    // alert INSERT + EventBus(ml.anomaly) → drone selection → inspection INSERT.
    // sensor_001 / "Temp Station Alpha" is a known DB fixture, so the anomaly
    // location is deterministic (unlike /predict which picks a random sensor).
    const ingestRes = await request(app).post("/api/sensors/ingest").send({
      sensorId: "sensor_001",
      sensorName: "Temp Station Alpha",
      temperature: 3.1,
      ph: 5.8,
      salinity: 34.5,
      oxygen: 1.5,
      turbidity: 18.0,
    });
    expect(ingestRes.status).toBe(202);

    // ── Robust wait: poll until a NEW inspection row appears ──────────────
    // (first call may cold-start the Python ML worker, so budget generously)
    const deadline = Date.now() + 10_000;
    let after = before;
    let latest: any = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      after = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;
      if (after > before) {
        latest = db.prepare(
          "SELECT * FROM drone_inspections ORDER BY started_at DESC LIMIT 1"
        ).get() as any;
        break;
      }
    }
    expect(after).toBeGreaterThan(before); // fails with count if never created

    // ── Inspection assertions (selection semantics, no name hardcoding) ───
    expect(latest.phase).toBe("en_route");
    expect(latest.drone_name).toBeTruthy();
    expect(latest.sensor_id).toBe("sensor_001");
    expect(latest.sensor_name).toBe("Temp Station Alpha");
    expect(latest.selection_reason).toContain("nearest eligible drone");
    expect(typeof latest.distance_km).toBe("number");
    expect(latest.distance_km).toBeGreaterThan(0);

    // The selected drone must satisfy the eligibility battery threshold.
    const selectedDrone = db.prepare(
      "SELECT battery, status FROM drones WHERE name = ?"
    ).get(latest.drone_name) as any;
    expect(selectedDrone).toBeTruthy();
    expect(selectedDrone.battery).toBeGreaterThanOrEqual(MIN_BATTERY_PCT);

    // ── Alert assertions — resolve the alert the inspection is LINKED to, ────
    // not "newest by timestamp" (a concurrently-running dev server shares this
    // DB and can insert a newer alert for the same sensor between our ingest
    // and the assertion). Production links the inspection to the alert it
    // created, synchronously, so alert_id is deterministic here.
    expect(latest.alert_id).toBeTruthy();
    const alert = db.prepare(
      "SELECT id, type, resolved, location, category FROM alerts WHERE id = ?"
    ).get(latest.alert_id) as any;
    expect(alert).toBeTruthy();
    expect(alert.type).toBe("critical");
    expect(alert.resolved).toBe(0);
    expect(alert.location).toBe("Temp Station Alpha");
    expect(alert.category).toBe("pollution");
  }, 20000);
});
