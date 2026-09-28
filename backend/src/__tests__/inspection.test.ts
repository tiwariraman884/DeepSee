/**
 * Inspection lifecycle tests — DB state machine + evidence integrity.
 * Uses the real SQLite database (same one the pipeline writes to), but only
 * reads/inserts its own fixture rows so it never corrupts live data.
 */
import { getDb } from "../db";

let inspectionId: string;

beforeAll(() => {
  // Trigger migrations (adds the additive columns if missing).
  getDb();
});

afterAll(() => {
  // Clean up fixture rows (evidence cascades on inspection delete).
  if (inspectionId) {
    try { getDb().prepare("DELETE FROM drone_inspections WHERE id = ?").run(inspectionId); } catch { /* ignore */ }
  }
});

describe("inspection state machine (drone_inspections)", () => {
  it("creates an inspection record in en_route phase", () => {
    const db = getDb();
    inspectionId = `test-insp-${Date.now()}`;
    db.prepare(`
      INSERT INTO drone_inspections
        (id, drone_id, drone_name, sensor_id, sensor_name, phase, eta_seconds, progress,
         target_lat, target_lng, origin_lat, origin_lng, route_json, started_at,
         selection_reason, distance_km)
      VALUES (?, ?, ?, ?, ?, 'en_route', 134, 0, 10, 10, 9.9, 9.9, '[]', ?, 'nearest eligible drone', 15.4)
    `).run(inspectionId, "test-drone", "Test Drone", "sensor_test", "Test Sensor", new Date().toISOString());

    const row = db.prepare("SELECT * FROM drone_inspections WHERE id = ?").get(inspectionId) as any;
    expect(row).toBeTruthy();
    expect(row.phase).toBe("en_route");
    expect(row.selection_reason).toBe("nearest eligible drone");
    expect(row.distance_km).toBeCloseTo(15.4);
  });

  it("progresses en_route → arrived → inspecting with progress updates", () => {
    const db = getDb();
    db.prepare("UPDATE drone_inspections SET phase = 'arrived', progress = 100 WHERE id = ?").run(inspectionId);
    expect(db.prepare("SELECT phase FROM drone_inspections WHERE id = ?").get(inspectionId).phase).toBe("arrived");

    db.prepare("UPDATE drone_inspections SET phase = 'inspecting', progress = 40, progress_label = 'Camera scan' WHERE id = ?").run(inspectionId);
    const row = db.prepare("SELECT * FROM drone_inspections WHERE id = ?").get(inspectionId) as any;
    expect(row.phase).toBe("inspecting");
    expect(row.progress).toBe(40);
    expect(row.progress_label).toBe("Camera scan");
  });

  it("completes with severity, summary and completed_at persisted", () => {
    const db = getDb();
    db.prepare(`
      UPDATE drone_inspections
      SET phase = 'complete', severity = 'high', summary = '2 threats identified', completed_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), inspectionId);
    const row = db.prepare("SELECT * FROM drone_inspections WHERE id = ?").get(inspectionId) as any;
    expect(row.phase).toBe("complete");
    expect(row.severity).toBe("high");
    expect(row.summary).toContain("threats identified");
    expect(row.completed_at).toBeTruthy();
  });
});

describe("inspection evidence (inspection_evidence)", () => {
  it("inserts evidence with a valid inspection reference and stored confidence", () => {
    const db = getDb();
    const evidenceId = `test-ev-${Date.now()}`;
    db.prepare(`
      INSERT INTO inspection_evidence (id, inspection_id, kind, label, confidence, detail, captured_at)
      VALUES (?, ?, 'marine_species', 'Test Species', 0.932, 'Simulated frame detection', ?)
    `).run(evidenceId, inspectionId, new Date().toISOString());

    const row = db.prepare("SELECT * FROM inspection_evidence WHERE id = ?").get(evidenceId) as any;
    expect(row).toBeTruthy();
    expect(row.inspection_id).toBe(inspectionId);
    expect(row.confidence).toBeCloseTo(0.932);
    expect(row.label).toBe("Test Species");

    db.prepare("DELETE FROM inspection_evidence WHERE id = ?").run(evidenceId);
  });

  it("rejects evidence referencing a non-existent inspection (FK)", () => {
    const db = getDb();
    expect(() =>
      db.prepare(`
        INSERT INTO inspection_evidence (id, inspection_id, kind, label, confidence, detail, captured_at)
        VALUES ('x', 'does-not-exist', 'kind', 'label', 0.5, 'd', datetime('now'))
      `).run()
    ).toThrow();
  });
});

describe("dispatch_unavailable alert (no eligible drone state)", () => {
  it("accepts a warning-class alert row for the response category", () => {
    const db = getDb();
    const id = `test-alert-${Date.now()}`;
    db.prepare(`
      INSERT INTO alerts (id, type, message, location, timestamp, read, resolved, category)
      VALUES (?, 'warning', 'No eligible drone — battery below threshold', 'Test Sensor', ?, 0, 0, 'response')
    `).run(id, new Date().toISOString());
    const row = db.prepare("SELECT type, category FROM alerts WHERE id = ?").get(id) as any;
    expect(row.type).toBe("warning");
    expect(row.category).toBe("response");
    db.prepare("DELETE FROM alerts WHERE id = ?").run(id);
  });
});
