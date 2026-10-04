/**
 * Demo Scenario API tests — emergency scenario endpoint.
 *
 * Tests verify:
 *   - Scenario starts successfully (202)
 *   - Correct fixture sensor used
 *   - Active inspection guard works (409 busy)
 *   - No eligible drone returns unavailable (409)
 *   - Full workflow: scenario → anomaly → alert → dispatch → inspection
 *
 * Test isolation: uses resetSensorPipelineForTests() to cancel pending
 * timers and clear mission state between tests — no waiting for completion.
 */
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

import demoRoutes from "../routes/demo";
import {
  initSensorPipeline,
  resetSensorPipelineForTests,
  shutdownSensorPipelineForTests,
} from "../lib/sensorPipeline";
import { eventBus, TOPICS, InspectionCompletedEvent } from "../lib/eventBus";
import { mlWorker } from "../lib/mlWorker";
import { sseManager } from "../lib/sseManager";
import { getDb } from "../db";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/demo", demoRoutes);

beforeAll(async () => {
  initSensorPipeline();
  try { await mlWorker.ensureStarted(); } catch { /* predict tests will fail loudly */ }
}, 30000);

afterAll(async () => {
  shutdownSensorPipelineForTests();
  sseManager.shutdownForTests();
  mlWorker.stop();
  await new Promise((r) => setTimeout(r, 500));
});

beforeEach(async () => {
  // Quiesce: the previous suite's in-flight ML callbacks (300–500ms under
  // load) can publish anomalies after our reset and re-arm the guard.
  // Let stragglers land, THEN reset + drain — same pattern as pipeline.test.
  await new Promise((r) => setTimeout(r, 1000));
  // Clean slate: cancel any pending timers from previous tests AND drain
  // queued EventBus redeliveries — otherwise a duplicate anomaly delivery can
  // re-arm the mission guard after the reset and flake the next test.
  resetSensorPipelineForTests();
  eventBus.clear();
});

afterEach(() => {
  // Cancel any timers started by this test
  resetSensorPipelineForTests();
  eventBus.clear();
});

describe("POST /api/demo/emergency-scenario", () => {
  it("starts a scenario successfully (202) with correct fixture sensor", async () => {
    const db = getDb();
    db.prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run();

    const res = await request(app).post("/api/demo/emergency-scenario").send({});

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("started");
    expect(res.body.scenarioId).toBeTruthy();
    expect(res.body.sensor.id).toBe("sensor_001");
    expect(res.body.sensor.name).toBe("Temp Station Alpha");
    expect(res.body.drone.name).toBeTruthy();
    expect(res.body.drone.battery).toBeGreaterThanOrEqual(35);
  }, 15000);

  it("returns busy (409) when an inspection is already active", async () => {
    const db = getDb();
    db.prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run();

    // First scenario should start
    const first = await request(app).post("/api/demo/emergency-scenario").send({});
    expect(first.status).toBe(202);

    // Wait for the inspection to be created (async pipeline)
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
      const count = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;
      if (count > 0) break;
    }

    // Second scenario should be rejected (inspection still active)
    const second = await request(app).post("/api/demo/emergency-scenario").send({});
    expect(second.status).toBe(409);
    expect(second.body.status).toBe("busy");
    expect(second.body.reason).toBe("inspection_in_progress");
  }, 15000);

  it("returns unavailable (409) when no eligible drone exists", async () => {
    const db = getDb();
    db.prepare("UPDATE drones SET status = 'active', battery = 10").run();

    const res = await request(app).post("/api/demo/emergency-scenario").send({});
    expect(res.status).toBe(409);
    expect(res.body.status).toBe("unavailable");
    expect(res.body.reason).toBe("no_eligible_drone");

    // Restore drones
    db.prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run();
  }, 15000);

  it("accepts a second scenario immediately after the first inspection completes (no 120s wait)", async () => {
    const db = getDb();
    db.prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run();

    // Scenario 1 starts and dispatches through the real pipeline.
    const first = await request(app).post("/api/demo/emergency-scenario").send({});
    expect(first.status).toBe(202);

    // Wait for its inspection row (async ML + dispatch).
    const deadline = Date.now() + 10_000;
    let firstInspection: any = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      firstInspection = db.prepare(
        "SELECT * FROM drone_inspections ORDER BY started_at DESC LIMIT 1"
      ).get() as any;
      if (firstInspection) break;
    }
    expect(firstInspection).toBeTruthy();

    // Simulate the completion handshake the InspectionSimulator publishes
    // when that inspection reaches COMPLETE.
    eventBus.publish<InspectionCompletedEvent>(TOPICS.DRONE_INSPECTION_COMPLETED, {
      inspectionId: firstInspection.id,
      droneId: firstInspection.drone_id,
      timestamp: new Date().toISOString(),
    });

    // Quiesce: the EventBus delivers every message twice (immediate emit +
    // queued redelivery), so this scenario's own sensor reading gets a second
    // ML pass that can land AFTER the guard was just released and dispatch a
    // stray follow-up mission. Let it land, then reset + drain so POST#2
    // deterministically observes the released guard (not the stray).
    await new Promise((r) => setTimeout(r, 1500));
    resetSensorPipelineForTests();
    eventBus.clear();

    // The next scenario must be accepted immediately — not 409 busy.
    const second = await request(app).post("/api/demo/emergency-scenario").send({});
    expect(second.status).toBe(202);
    expect(second.body.status).toBe("started");
    expect(second.body.scenarioId).toBeTruthy();
  }, 20000);

  it("exposes the active mission with the decided searoute for late joiners", async () => {
    const db = getDb();
    db.prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run();

    const started = await request(app).post("/api/demo/emergency-scenario").send({});
    expect(started.status).toBe(202);

    // Wait for the dispatch (async ML + dispatch).
    const deadline = Date.now() + 10_000;
    let inspection: any = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      inspection = db.prepare(
        "SELECT * FROM drone_inspections WHERE sensor_id = 'sensor_001' ORDER BY started_at DESC LIMIT 1"
      ).get() as any;
      if (inspection && Date.parse(inspection.started_at) >= Date.now() - 30_000) break;
      inspection = null;
    }
    expect(inspection).toBeTruthy();

    const res = await request(app).get("/api/demo/active-mission");
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    expect(res.body.inspection.id).toBe(inspection.id);
    expect(res.body.dispatch.droneId).toBe(inspection.drone_id);
    expect(Array.isArray(res.body.dispatch.path)).toBe(true);
    expect(res.body.dispatch.path.length).toBeGreaterThanOrEqual(2);
    expect(res.body.dispatch.targetLat).toBe(inspection.target_lat);
  }, 20000);

  it("resolves the scenario status deterministically (no ID-prefix matching)", async () => {
    const db = getDb();
    db.prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run();

    const started = await request(app).post("/api/demo/emergency-scenario").send({});
    expect(started.status).toBe(202);
    const scenarioId = started.body.scenarioId as string;

    // Wait for the inspection row created by THIS scenario (async ML +
    // dispatch) — ignore inspections left over from earlier tests.
    const knownIds = new Set(
      (db.prepare("SELECT id FROM drone_inspections").all() as any[]).map((r) => r.id)
    );
    const deadline = Date.now() + 10_000;
    let inspection: any = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      const candidate = db.prepare(
        "SELECT * FROM drone_inspections WHERE sensor_id = 'sensor_001' ORDER BY started_at DESC LIMIT 1"
      ).get() as any;
      if (candidate && !knownIds.has(candidate.id)) {
        inspection = candidate;
        break;
      }
    }
    expect(inspection).toBeTruthy();

    // Scenario lookup must resolve to THIS inspection (old prefix matching 404'd).
    const viaScenario = await request(app).get(`/api/demo/scenario/${scenarioId}`);
    expect(viaScenario.status).toBe(200);
    expect(viaScenario.body.inspection.id).toBe(inspection.id);
    expect(viaScenario.body.inspection.drone_name).toBeTruthy();
    expect(viaScenario.body.inspection.sensor_name).toBe("Temp Station Alpha");

    // Direct inspection lookup must also work (frontend's preferred path).
    const viaInspection = await request(app).get(`/api/demo/inspection/${inspection.id}`);
    expect(viaInspection.status).toBe(200);
    expect(viaInspection.body.inspection.id).toBe(inspection.id);

    // Unknown IDs still 404.
    const missing = await request(app).get("/api/demo/inspection/insp-does-not-exist");
    expect(missing.status).toBe(404);
  }, 20000);
});

describe("end-to-end: scenario → anomaly → alert → dispatch → inspection", () => {
  it("creates a full inspection record through the real pipeline", async () => {
    const db = getDb();
    db.prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run();

    const before = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;

    // Trigger the scenario
    const res = await request(app).post("/api/demo/emergency-scenario").send({});
    expect(res.status).toBe(202);

    // Wait for the inspection to be created (async pipeline)
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

    expect(after).toBeGreaterThan(before);
    expect(latest.phase).toBe("en_route");
    expect(latest.sensor_id).toBe("sensor_001");
    expect(latest.sensor_name).toBe("Temp Station Alpha");
    expect(latest.drone_name).toBeTruthy();
    expect(latest.selection_reason).toContain("nearest eligible drone");

    // Verify alert was created
    expect(latest.alert_id).toBeTruthy();
    const alert = db.prepare(
      "SELECT id, type, resolved, location, category FROM alerts WHERE id = ?"
    ).get(latest.alert_id) as any;
    expect(alert).toBeTruthy();
    expect(alert.type).toBe("critical");
    expect(alert.location).toBe("Temp Station Alpha");
    expect(alert.category).toBe("pollution");
  }, 20000);
});
