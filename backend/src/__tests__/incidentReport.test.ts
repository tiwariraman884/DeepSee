/**
 * Automated Incident Report API tests (Step 4).
 *
 *   A. Completed inspection → 200 with all report sections
 *   B. Unknown inspection → 404
 *   C. Incomplete (en_route) inspection → 409, no misleading final report
 *   D. PDF export → 200 application/pdf, non-empty
 *   E. Repeat generation → same snapshot, no duplicate rows
 *   F. Unauthenticated request → 401
 *
 * Fixtures are inserted directly (deterministic, no 50s pipeline wait) and
 * removed in afterAll. No pipeline/ML handles are opened by this suite.
 */
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

import reportsRoutes from "../routes/reports";
import { getDb } from "../db";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/reports", reportsRoutes);

const FIX = {
  sensorId: "sensor_ir_001",
  alertId: "alert-ir-001",
  inspectionId: "insp-ir-001",
  incompleteId: "insp-ir-002",
};

function seedFixtures(): void {
  const db = getDb();
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const started = iso(now - 60_000);
  const detected = iso(now - 55_000);
  const completed = iso(now);

  db.prepare(
    `INSERT OR REPLACE INTO sensors (id, name, type, lat, lng, online, status, updated_at, last_reading_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(FIX.sensorId, "Incident Test Station", "temperature", 6.9, 73.1, 1, "online", detected, "{}");

  db.prepare(
    `INSERT OR REPLACE INTO sensor_readings (sensor_id, ph, temp, salinity, oxygen, turbidity, recorded_at, source, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(FIX.sensorId, 5.8, 3.1, 34.5, 1.5, 18.0, detected, "manual", null);

  db.prepare(
    `INSERT OR REPLACE INTO alerts (id, type, message, location, timestamp, read, resolved, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    FIX.alertId, "critical",
    "AI Anomaly Detected — pH 5.80, Turbidity 18.0 NTU",
    "Incident Test Station", detected, 0, 0, "pollution"
  );

  const threatJson = JSON.stringify([
    { kind: "oil_film", label: "Oil/Chemical Film", confidence: 0.91, detail: "Sheen consistent with hydrocarbons" },
    { kind: "marine_species", label: "Otter", confidence: 97.7, detail: "Resident classifier detection" },
  ]);

  db.prepare(
    `INSERT OR REPLACE INTO drone_inspections
       (id, drone_id, drone_name, alert_id, sensor_id, sensor_name, phase,
        eta_seconds, progress, target_lat, target_lng, origin_lat, origin_lng,
        route_json, severity, threat_json, summary, started_at, completed_at,
        selection_reason, distance_km)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    FIX.inspectionId, "drone_ir_01", "TestDrone-01", FIX.alertId, FIX.sensorId,
    "Incident Test Station", "complete",
    45, 100, 6.9, 73.1, 6.8, 73.0, "[]",
    "critical", threatJson,
    "2 threats identified at Incident Test Station: Oil/Chemical Film, Otter. ML anomaly score 0.770 — severity classified as critical.",
    started, completed,
    "nearest eligible drone (test)", 12.5
  );

  db.prepare(
    `INSERT OR REPLACE INTO inspection_evidence (id, inspection_id, kind, label, confidence, detail, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run("ev-ir-001", FIX.inspectionId, "oil_film", "Oil/Chemical Film", 0.91, "Sheen consistent with hydrocarbons", iso(now - 30_000));
  db.prepare(
    `INSERT OR REPLACE INTO inspection_evidence (id, inspection_id, kind, label, confidence, detail, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run("ev-ir-002", FIX.inspectionId, "marine_species", "Otter", 97.7, "Resident classifier detection", iso(now - 20_000));

  // Incomplete fixture for the 409 case.
  db.prepare(
    `INSERT OR REPLACE INTO drone_inspections
       (id, drone_id, drone_name, sensor_id, sensor_name, phase,
        eta_seconds, progress, target_lat, target_lng, origin_lat, origin_lng,
        route_json, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    FIX.incompleteId, "drone_ir_01", "TestDrone-01", FIX.sensorId,
    "Incident Test Station", "en_route",
    45, 10, 6.9, 73.1, 6.8, 73.0, "[]", iso(now - 10_000)
  );
}

function removeFixtures(): void {
  const db = getDb();
  try {
    db.prepare("DELETE FROM incident_reports WHERE inspection_id IN (?, ?)").run(FIX.inspectionId, FIX.incompleteId);
    db.prepare("DELETE FROM inspection_evidence WHERE inspection_id IN (?, ?)").run(FIX.inspectionId, FIX.incompleteId);
    db.prepare("DELETE FROM drone_inspections WHERE id IN (?, ?)").run(FIX.inspectionId, FIX.incompleteId);
    db.prepare("DELETE FROM alerts WHERE id = ?").run(FIX.alertId);
    db.prepare("DELETE FROM sensor_readings WHERE sensor_id = ?").run(FIX.sensorId);
    db.prepare("DELETE FROM sensors WHERE id = ?").run(FIX.sensorId);
  } catch { /* best-effort test cleanup */ }
}

beforeAll(() => {
  removeFixtures();
  seedFixtures();
});

afterAll(() => {
  removeFixtures();
});

describe("GET /api/reports/incidents/:inspectionId", () => {
  it("A. returns 200 with all report sections for a completed inspection", async () => {
    const res = await request(app).get(`/api/reports/incidents/${FIX.inspectionId}`);
    expect(res.status).toBe(200);
    const { report } = res.body;
    expect(report).toBeTruthy();

    // All required top-level sections.
    for (const key of ["incident", "detection", "sensorReadings", "response", "inspection", "evidence", "timeline", "finalAssessment", "vision"]) {
      expect(report[key]).toBeTruthy();
    }

    // Identity + traceability.
    expect(report.reportId).toBe(`INC-${FIX.inspectionId}`);
    expect(report.inspectionId).toBe(FIX.inspectionId);
    expect(report.generatedAt).toBeTruthy();
    expect(report.incident.alertId).toBe(FIX.alertId);
    expect(report.incident.sensorId).toBe(FIX.sensorId);
    expect(report.incident.severity).toBe("critical");
    expect(report.incident.dataSource).toBe("manual");
    expect(report.response.droneName).toBe("TestDrone-01");

    // Real trigger reading (note: DB column `temp` → report `temperature`).
    expect(report.sensorReadings.temperature).toBe(3.1);
    expect(report.sensorReadings.ph).toBe(5.8);
    expect(report.sensorReadings.turbidity).toBe(18.0);

    // Anomaly score parsed from the persisted summary (not fabricated).
    expect(report.detection.anomalyScore).toBeCloseTo(0.77, 2);

    // Evidence chronological, confidence normalized (0.91 → "91%", 97.7 → "98%").
    expect(report.evidence).toHaveLength(2);
    expect(report.evidence[0].id).toBe("ev-ir-001");
    expect(report.evidence[0].confidenceDisplay).toBe("91%");
    expect(report.evidence[1].confidenceDisplay).toBe("98%");

    // Duration from persisted timestamps.
    expect(report.inspection.durationSeconds).toBe(60);

    // Timeline has no fabricated entries — every timestamp is persisted.
    expect(report.timeline.length).toBeGreaterThanOrEqual(5);
    const events = report.timeline.map((t: any) => t.event);
    expect(events).toContain("Inspection completed");

    // Disclosure present.
    expect(report.disclosure).toContain("simulated");
  });

  it("B. returns 404 for an unknown inspection", async () => {
    const res = await request(app).get("/api/reports/incidents/insp-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it("C. returns 409 for an incomplete inspection", async () => {
    const res = await request(app).get(`/api/reports/incidents/${FIX.incompleteId}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });

  it("D. returns a non-empty PDF", async () => {
    const res = await request(app).get(`/api/reports/incidents/${FIX.inspectionId}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    const size = Number(res.headers["content-length"]) || (res.text?.length ?? 0);
    expect(size).toBeGreaterThan(1000);
  });

  it("E. repeat generation returns the same snapshot without duplicates", async () => {
    const db = getDb();
    const first = await request(app).get(`/api/reports/incidents/${FIX.inspectionId}`);
    expect(first.status).toBe(200);
    const second = await request(app).get(`/api/reports/incidents/${FIX.inspectionId}`);
    expect(second.status).toBe(200);
    expect(second.body.report.reportId).toBe(first.body.report.reportId);
    expect(second.body.report.generatedAt).toBe(first.body.report.generatedAt);

    const count = (db.prepare(
      "SELECT COUNT(*) c FROM incident_reports WHERE inspection_id = ?"
    ).get(FIX.inspectionId) as any).c;
    expect(count).toBe(1);
  });

  it("F. rejects unauthenticated requests", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development"; // enforce real auth for this check
    try {
      const res = await request(app).get(`/api/reports/incidents/${FIX.inspectionId}`);
      expect(res.status).toBe(401);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe("GET /api/reports/incidents", () => {
  it("lists persisted incident snapshots", async () => {
    // Ensure at least one snapshot exists.
    await request(app).get(`/api/reports/incidents/${FIX.inspectionId}`);
    const res = await request(app).get("/api/reports/incidents?severity=critical");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
    const found = res.body.reports.find((r: any) => r.inspectionId === FIX.inspectionId);
    expect(found).toBeTruthy();
    expect(found.severity).toBe("critical");
  });
});
