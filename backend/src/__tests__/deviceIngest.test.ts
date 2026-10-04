/**
 * ESP32 device gateway tests (Phase 6A).
 *
 *   - Device auth: valid → 202 · missing → 401 · wrong key → 403 · unknown ID → 403
 *   - Temp-only hardware ingest → 202, persisted with source=hardware +
 *     device_id, ML honestly NOT triggered (no inspection, mlReady=false)
 *   - Full 5-feature hardware vector → real ML → anomaly → dispatch (same pipeline)
 *   - Browser ingest still works with source=manual (no regression)
 */
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

process.env.ESP32_DEVICE_KEYS = "esp32_001:test-device-secret";

import sensorsRoutes from "../routes/sensors";
import systemRoutes from "../routes/system";
import {
  initSensorPipeline,
  resetSensorPipelineForTests,
  shutdownSensorPipelineForTests,
} from "../lib/sensorPipeline";
import { resetDeviceRegistryForTests } from "../lib/deviceRegistry";
import { eventBus } from "../lib/eventBus";
import { mlWorker } from "../lib/mlWorker";
import { sseManager } from "../lib/sseManager";
import { getDb } from "../db";

const DEVICE = { id: "esp32_001", key: "test-device-secret" };

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/sensors", sensorsRoutes);
app.use("/api/system", systemRoutes);

beforeAll(async () => {
  initSensorPipeline();
  getDb(); // ensure migration (esp32_001 registration) has run
  try { await mlWorker.ensureStarted(); } catch { /* full-vector test needs ML */ }
}, 60000);

afterAll(async () => {
  shutdownSensorPipelineForTests();
  sseManager.shutdownForTests();
  mlWorker.stop();
  eventBus.clear();
  try {
    getDb().prepare("UPDATE drones SET status = 'idle'").run();
    getDb().prepare("UPDATE sensors SET online = 0 WHERE id = 'esp32_001'").run();
  } catch { /* best-effort */
  }
  await new Promise((r) => setTimeout(r, 500));
});

/** Test-only write helper: the shared file DB can be momentarily write-locked
 * by a concurrently running dev server or straggler callbacks (separate DB
 * connection). Retry briefly instead of flaking. Production code untouched. */
function dbWrite<T>(fn: () => T, attempts = 10): T {
  let last: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (e: any) {
      last = e;
      if (!/locked|busy/i.test(e?.message ?? "")) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  throw last;
}

beforeEach(async () => {
  // Quiesce first (see demo.test.ts): drain previous-suite ML stragglers
  // before resetting, so no late anomaly re-arms state mid-test.
  await new Promise((r) => setTimeout(r, 1000));
  resetSensorPipelineForTests();
  eventBus.clear();
  dbWrite(() => getDb().prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run());
});

afterEach(() => {
  resetSensorPipelineForTests();
  eventBus.clear();
});

function deviceHeaders(key: string = DEVICE.key, id: string = DEVICE.id) {
  return { "X-Device-Id": id, "X-Device-Key": key };
}

async function waitFor(
  fn: () => any,
  timeoutMs = 5000,
  intervalMs = 200
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let last: any = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    last = fn();
    if (last) return last;
  }
  return last;
}

describe("device authentication", () => {
  it("rejects missing credentials (401)", async () => {
    const res = await request(app)
      .post("/api/sensors/ingest")
      .set({ "X-Device-Id": DEVICE.id })
      .send({ sensorId: DEVICE.id, temperature: 27.4 });
    expect(res.status).toBe(401);
  });

  it("rejects a wrong key (403)", async () => {
    const res = await request(app)
      .post("/api/sensors/ingest")
      .set(deviceHeaders("wrong-secret"))
      .send({ sensorId: DEVICE.id, temperature: 27.4 });
    expect(res.status).toBe(403);
  });

  it("rejects an unregistered device ID (403)", async () => {
    const res = await request(app)
      .post("/api/sensors/ingest")
      .set(deviceHeaders(DEVICE.key, "esp32_999"))
      .send({ sensorId: "esp32_999", temperature: 27.4 });
    expect(res.status).toBe(403);
  });
});

describe("hardware ingest (temperature-only DS18B20)", () => {
  it("accepts telemetry (202), persists source=hardware, and does NOT run ML", async () => {
    const db = getDb();
    const inspBefore = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;

    const res = await request(app)
      .post("/api/sensors/ingest")
      .set(deviceHeaders())
      .send({ sensorId: DEVICE.id, sensorName: "DeepSea ESP32 Station 001", temperature: 27.4 });
    expect(res.status).toBe(202);
    expect(res.body.source).toBe("hardware");
    expect(res.body.deviceId).toBe(DEVICE.id);
    expect(res.body.mlReady).toBe(false);
    expect(res.body.missingFeatures).toEqual(
      expect.arrayContaining(["ph", "salinity", "oxygen", "turbidity"])
    );

    // Persisted with provenance…
    const row = await waitFor(
      () =>
        db.prepare(
          "SELECT temp, source, device_id FROM sensor_readings WHERE sensor_id = ? ORDER BY recorded_at DESC LIMIT 1"
        ).get(DEVICE.id) as any,
      5000
    );
    expect(row).toBeTruthy();
    expect(row.temp).toBeCloseTo(27.4, 1);
    expect(row.source).toBe("hardware");
    expect(row.device_id).toBe(DEVICE.id);

    // …heartbeat marks the sensor online…
    const sensor = db.prepare("SELECT online FROM sensors WHERE id = ?").get(DEVICE.id) as any;
    expect(sensor.online).toBe(1);

    // …but the incomplete vector never reaches the anomaly model:
    // no inspection may appear for this device.
    await new Promise((r) => setTimeout(r, 1500));
    const inspAfter = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;
    expect(inspAfter).toBe(inspBefore);
  }, 20000);
});

describe("hardware ingest (full 5-feature vector)", () => {
  it("runs the real ML → anomaly → dispatch pipeline", async () => {
    const db = getDb();
    const before = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;

    const res = await request(app)
      .post("/api/sensors/ingest")
      .set(deviceHeaders())
      .send({
        sensorId: DEVICE.id,
        sensorName: "DeepSea ESP32 Station 001",
        temperature: 3.1, ph: 5.8, salinity: 34.5, oxygen: 1.5, turbidity: 18.0,
      });
    expect(res.status).toBe(202);
    expect(res.body.mlReady).toBe(true);

    const latest = await waitFor(() => {
      const after = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;
      if (after <= before) return null;
      return db.prepare(
        "SELECT * FROM drone_inspections WHERE sensor_id = ? ORDER BY started_at DESC LIMIT 1"
      ).get(DEVICE.id) as any;
    }, 15000);
    expect(latest).toBeTruthy();
    expect(latest.phase).toBe("en_route");
  }, 30000);
});

describe("hardware ingest (partial vector)", () => {
  it("B. omits one field → 202, mlReady=false, no inspection", async () => {
    const db = getDb();
    const before = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;

    const res = await request(app)
      .post("/api/sensors/ingest")
      .set(deviceHeaders())
      .send({
        sensorId: DEVICE.id,
        temperature: 27.1, ph: 8.02, salinity: 34.6, oxygen: 5.1,
        // turbidity omitted — real partial vector
      });
    expect(res.status).toBe(202);
    expect(res.body.mlReady).toBe(false);
    expect(res.body.missingFeatures).toEqual(["turbidity"]);

    await new Promise((r) => setTimeout(r, 1500));
    const after = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;
    expect(after).toBe(before);
  }, 20000);
});

describe("hardware ingest validation (Zod ranges)", () => {
  it.each([
    ["C. invalid pH", { temperature: 27.1, ph: 20, salinity: 34.6, oxygen: 5.1, turbidity: 0.8 }],
    ["D. invalid salinity", { temperature: 27.1, ph: 8.02, salinity: 60, oxygen: 5.1, turbidity: 0.8 }],
    ["E. invalid oxygen", { temperature: 27.1, ph: 8.02, salinity: 34.6, oxygen: -1, turbidity: 0.8 }],
  ])("%s → 400 with no database write", async (_label, values) => {
    const db = getDb();
    const before = (db.prepare(
      "SELECT COUNT(*) c FROM sensor_readings WHERE sensor_id = ?"
    ).get(DEVICE.id) as any).c;

    const res = await request(app)
      .post("/api/sensors/ingest")
      .set(deviceHeaders())
      .send({ sensorId: DEVICE.id, ...values });
    expect(res.status).toBe(400);

    const after = (db.prepare(
      "SELECT COUNT(*) c FROM sensor_readings WHERE sensor_id = ?"
    ).get(DEVICE.id) as any).c;
    expect(after).toBe(before);
  });
});

describe("hardware normal vector", () => {
  it("G. known normal vector → mlReady=true, no anomaly inspection", async () => {
    const db = getDb();
    const before = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;

    const res = await request(app)
      .post("/api/sensors/ingest")
      .set(deviceHeaders())
      .send({
        sensorId: DEVICE.id,
        temperature: 3.1, ph: 8.05, salinity: 34.5, oxygen: 5.2, turbidity: 0.4,
      });
    expect(res.status).toBe(202);
    expect(res.body.mlReady).toBe(true);
    expect(res.body.missingFeatures).toEqual([]);

    await new Promise((r) => setTimeout(r, 2000));
    const after = (db.prepare("SELECT COUNT(*) c FROM drone_inspections").get() as any).c;
    expect(after).toBe(before);
  }, 25000);
});

describe("firmware test mode", () => {
  it("marks bench vectors as hardware_test, never real hardware", async () => {
    const db = getDb();
    const res = await request(app)
      .post("/api/sensors/ingest")
      .set({ ...deviceHeaders(), "X-Device-Mode": "test" })
      .send({ sensorId: DEVICE.id, temperature: 27.0 });
    expect(res.status).toBe(202);
    expect(res.body.source).toBe("hardware_test");

    const row = await waitFor(
      () =>
        db.prepare(
          "SELECT source FROM sensor_readings WHERE sensor_id = ? AND source = 'hardware_test' ORDER BY recorded_at DESC LIMIT 1"
        ).get(DEVICE.id) as any,
      5000
    );
    expect(row?.source).toBe("hardware_test");
  }, 20000);
});

describe("device diagnostics", () => {
  it("accepts throttled diagnostics with device auth", async () => {
    const res = await request(app)
      .post("/api/sensors/diagnostics")
      .set(deviceHeaders())
      .send({
        firmwareVersion: "0.2.0",
        uptimeSeconds: 1234,
        wifiRssi: -61,
        pressureSource: "not_measured",
        sensors: { temperature: "OK", ph: "OK", oxygen: "MISSING", salinity: "OK", turbidity: "OK" },
      });
    expect(res.status).toBe(202);
    expect(res.body.deviceId).toBe(DEVICE.id);
  });

  it("rejects diagnostics without device credentials (401)", async () => {
    const res = await request(app)
      .post("/api/sensors/diagnostics")
      .send({ firmwareVersion: "0.2.0" });
    expect(res.status).toBe(401);
  });

  it("surfaces validation session + calibration states in System Intelligence", async () => {
    resetDeviceRegistryForTests();
    await request(app)
      .post("/api/sensors/diagnostics")
      .set(deviceHeaders())
      .send({
        firmwareVersion: "0.2.0",
        validationSessionId: "VAL-20260928-001",
        uptimeSeconds: 600,
        wifiRssi: -58,
        pressureSource: "not_measured",
        sensors: { temperature: "OK", ph: "OK", oxygen: "OK", salinity: "OK", turbidity: "OK" },
        calibration: {
          temperature: "CALIBRATED",
          ph: "CALIBRATED",
          oxygen: "CALIBRATION_REQUIRED",
          salinity: "CALIBRATED",
          turbidity: "CALIBRATION_REQUIRED",
        },
      });

    const res = await request(app).get("/api/system/intelligence");
    expect(res.status).toBe(200);
    const diag = res.body.hardware?.diagnostics;
    expect(diag).toBeTruthy();
    expect(diag.validationSessionId).toBe("VAL-20260928-001");
    expect(diag.calibration.ph).toBe("CALIBRATED");
    expect(diag.calibration.oxygen).toBe("CALIBRATION_REQUIRED");
    expect(diag.pressureSource).toBe("not_measured");
    resetDeviceRegistryForTests();
  });
});
describe("browser ingest regression", () => {
  it("still accepts user readings with source=manual", async () => {
    const res = await request(app)
      .post("/api/sensors/ingest")
      .send({
        sensorId: "sensor_001",
        sensorName: "Temp Station Alpha",
        temperature: 3.1, ph: 8.05, salinity: 34.5, oxygen: 5.2, turbidity: 0.4,
      });
    expect(res.status).toBe(202);
    expect(res.body.source).toBe("manual");
    expect(res.body.mlReady).toBe(true);
  });
});
