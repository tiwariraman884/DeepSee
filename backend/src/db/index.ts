import path from "path";
import fs from "fs";

// ─── Database singleton ───────────────────────────────────────────────────────
// Uses Node 22+ built-in node:sqlite (or better-sqlite3 as fallback)
// File-based SQLite database stored in .data/deepsea.db.

const DATA_DIR = path.join(process.cwd(), "..", ".data");
const DB_PATH = path.join(DATA_DIR, "deepsea.db");

let _db: any = null;

export function getDb(): any {
  if (_db) return _db;

  // Ensure .data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  try {
    const { DatabaseSync } = require("node:sqlite");
    const rawDb = new DatabaseSync(DB_PATH);
    rawDb.exec("PRAGMA journal_mode = WAL");
    rawDb.exec("PRAGMA foreign_keys = ON");
    rawDb.pragma = (str: string) => rawDb.exec(`PRAGMA ${str}`);
    _db = rawDb;
  } catch {
    const Database = require("better-sqlite3");
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }

  // Run migrations on first connection
  runMigrations(_db);

  // Add password_hash column to existing DBs that predate this column
  try { _db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT"); } catch {}

  return _db;
}

// ─── Schema DDL ──────────────────────────────────────────────────────────────

function runMigrations(db: any): void {
  db.exec(`
    -- ── Users ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password      TEXT NOT NULL DEFAULT '',
      password_hash TEXT,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login    TEXT
    );
    -- Add password_hash column if upgrading from older schema
    -- (SQLite ignores errors from duplicate column adds via try/catch below)

    -- ── User Settings (per-user, stored as JSON blob) ──────────────────────
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      settings_json TEXT NOT NULL DEFAULT '{}',
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Pollution Events ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS pollution_events (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      type           TEXT NOT NULL,
      latitude       REAL NOT NULL,
      longitude      REAL NOT NULL,
      severity       INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 10),
      concentration  REAL NOT NULL,
      affected_area  REAL NOT NULL,
      region         TEXT NOT NULL,
      detected_at    TEXT NOT NULL,
      trend          TEXT NOT NULL CHECK(trend IN ('increasing','stable','decreasing')),
      status         TEXT NOT NULL CHECK(status IN ('active','responding','resolved')),
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_poll_severity ON pollution_events(severity);
    CREATE INDEX IF NOT EXISTS idx_poll_region   ON pollution_events(region);
    CREATE INDEX IF NOT EXISTS idx_poll_status   ON pollution_events(status);
    CREATE INDEX IF NOT EXISTS idx_poll_type     ON pollution_events(type);

    -- ── Drones ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS drones (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      status             TEXT NOT NULL CHECK(status IN ('active','returning','charging','idle','offline')),
      battery            INTEGER NOT NULL CHECK(battery BETWEEN 0 AND 100),
      lat                REAL NOT NULL,
      lng                REAL NOT NULL,
      depth              REAL NOT NULL,
      speed              REAL NOT NULL,
      region             TEXT NOT NULL,
      last_update        TEXT NOT NULL,
      current_mission_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_drones_status ON drones(status);
    CREATE INDEX IF NOT EXISTS idx_drones_region ON drones(region);

    -- ── Missions ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS missions (
      id          TEXT PRIMARY KEY,
      drone_id    TEXT NOT NULL,
      drone_name  TEXT NOT NULL,
      name        TEXT NOT NULL,
      status      TEXT NOT NULL CHECK(status IN ('active','completed','scheduled','aborted')),
      progress    INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
      route_json  TEXT NOT NULL DEFAULT '[]',
      started_at  TEXT NOT NULL,
      objective   TEXT NOT NULL,
      coverage    REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_missions_status   ON missions(status);
    CREATE INDEX IF NOT EXISTS idx_missions_drone_id ON missions(drone_id);

    -- ── Sensors ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sensors (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      type              TEXT NOT NULL CHECK(type IN ('temperature','salinity','oxygen','ph','turbidity','pollution')),
      lat               REAL NOT NULL,
      lng               REAL NOT NULL,
      online            INTEGER NOT NULL DEFAULT 1,
      status            TEXT NOT NULL DEFAULT 'online' CHECK(status IN ('online','offline','maintenance')),
      updated_at        TEXT NOT NULL,
      last_reading_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_sensors_type   ON sensors(type);
    CREATE INDEX IF NOT EXISTS idx_sensors_status ON sensors(status);

    -- ── Sensor Readings (time-series) ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id   TEXT    NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
      ph          REAL,
      temp        REAL,
      salinity    REAL,
      oxygen      REAL,
      turbidity   REAL,
      recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sr_sensor ON sensor_readings(sensor_id);
    CREATE INDEX IF NOT EXISTS idx_sr_time   ON sensor_readings(recorded_at);

    -- ── Species ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS species (
      id                    TEXT PRIMARY KEY,
      name                  TEXT NOT NULL,
      scientific_name       TEXT NOT NULL,
      status                TEXT NOT NULL,
      category              TEXT NOT NULL CHECK(category IN ('fish','coral','mammal','reptile')),
      conservation          TEXT NOT NULL CHECK(conservation IN ('endangered','vulnerable','stable')),
      image                 TEXT,
      population_json       TEXT NOT NULL DEFAULT '[]',
      population_trend      TEXT NOT NULL CHECK(population_trend IN ('increasing','stable','decreasing')),
      habitat               TEXT NOT NULL,
      region                TEXT NOT NULL,
      conservation_progress INTEGER NOT NULL CHECK(conservation_progress BETWEEN 0 AND 100),
      threat_level          TEXT NOT NULL CHECK(threat_level IN ('low','medium','high','critical')),
      threats_json          TEXT NOT NULL DEFAULT '[]',
      lat                   REAL NOT NULL,
      lng                   REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_species_status   ON species(status);
    CREATE INDEX IF NOT EXISTS idx_species_category ON species(category);
    CREATE INDEX IF NOT EXISTS idx_species_region   ON species(region);

    -- ── Alerts ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS alerts (
      id             TEXT PRIMARY KEY,
      type           TEXT NOT NULL CHECK(type IN ('critical','warning','info')),
      message        TEXT NOT NULL,
      location       TEXT NOT NULL,
      timestamp      TEXT NOT NULL,
      read           INTEGER NOT NULL DEFAULT 0,
      resolved       INTEGER NOT NULL DEFAULT 0,
      category       TEXT NOT NULL,
      related_entity TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
    CREATE INDEX IF NOT EXISTS idx_alerts_type     ON alerts(type);
    CREATE INDEX IF NOT EXISTS idx_alerts_ts       ON alerts(timestamp DESC);

    -- ── Reports ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS reports (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL,
      author_id  TEXT,
      status     TEXT NOT NULL DEFAULT 'published',
      tags_json  TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Drone Inspection Missions ─────────────────────────────────────────
    -- Lifecycle for the anomaly-response workflow:
    --   en_route → arrived → inspecting → complete | aborted
    -- Distinct from 'missions' (planned survey work); these are reactive
    -- inspection flights triggered by a detected anomaly.
    CREATE TABLE IF NOT EXISTS drone_inspections (
      id                TEXT PRIMARY KEY,
      drone_id          TEXT NOT NULL,
      drone_name        TEXT NOT NULL,
      alert_id          TEXT,
      sensor_id         TEXT,
      sensor_name       TEXT,
      phase             TEXT NOT NULL CHECK(phase IN ('en_route','arrived','inspecting','complete','aborted')),
      eta_seconds       INTEGER NOT NULL DEFAULT 0,
      progress          INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
      target_lat        REAL NOT NULL,
      target_lng        REAL NOT NULL,
      origin_lat        REAL NOT NULL,
      origin_lng        REAL NOT NULL,
      route_json        TEXT NOT NULL DEFAULT '[]',
      severity          TEXT,
      threat_json       TEXT NOT NULL DEFAULT '[]',
      summary           TEXT,
      started_at        TEXT NOT NULL,
      completed_at      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_insp_phase    ON drone_inspections(phase);
    CREATE INDEX IF NOT EXISTS idx_insp_drone    ON drone_inspections(drone_id);
    CREATE INDEX IF NOT EXISTS idx_insp_started  ON drone_inspections(started_at DESC);

    -- ── Inspection Evidence ───────────────────────────────────────────────
    -- Individual findings captured during the on-site inspection phase.
    CREATE TABLE IF NOT EXISTS inspection_evidence (
      id            TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL REFERENCES drone_inspections(id) ON DELETE CASCADE,
      kind          TEXT NOT NULL,
      label         TEXT NOT NULL,
      confidence    REAL NOT NULL DEFAULT 0,
      detail        TEXT,
      captured_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_insp ON inspection_evidence(inspection_id);
  `);

  // ── Additive migrations for the inspection upgrade ──────────────────────
  // New columns on an existing table (SQLite supports ADD COLUMN only).
  const addColumn = (table: string, ddl: string) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`); } catch { /* already exists */ }
  };
  addColumn("drone_inspections", "selection_reason TEXT");
  addColumn("drone_inspections", "distance_km REAL");
  addColumn("drone_inspections", "progress_label TEXT");

  // ── Vision frames + evidence provenance (Phase 6D) ─────────────────────────
  // Additive + nullable: all historical rows keep working.
  db.exec(`
    CREATE TABLE IF NOT EXISTS vision_frames (
      id                TEXT PRIMARY KEY,
      inspection_id     TEXT,
      source_type       TEXT NOT NULL,
      source_device_id  TEXT,
      camera_id         TEXT,
      sequence_number   INTEGER NOT NULL DEFAULT 0,
      captured_at       TEXT NOT NULL,
      width             INTEGER,
      height            INTEGER,
      mime_type         TEXT,
      quality_status    TEXT,
      brightness        REAL,
      sharpness         REAL,
      processing_status TEXT NOT NULL DEFAULT 'QUEUED',
      inference_ms      INTEGER,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_vision_frames_inspection
      ON vision_frames(inspection_id);
    CREATE INDEX IF NOT EXISTS idx_vision_frames_captured
      ON vision_frames(captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vision_frames_source
      ON vision_frames(source_type);
  `);
  try { db.exec("ALTER TABLE inspection_evidence ADD COLUMN frame_id TEXT"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE inspection_evidence ADD COLUMN source_type TEXT"); } catch { /* exists */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_evidence_frame ON inspection_evidence(frame_id)"); } catch { /* exists */ }

  // ── Incident reports (Step 4: Automated Incident Report) ───────────────────
  // One snapshot row per completed inspection; inspection_id UNIQUE prevents
  // duplicate reports when generation is requested repeatedly.
  db.exec(`
    CREATE TABLE IF NOT EXISTS incident_reports (
      id              TEXT PRIMARY KEY,
      inspection_id   TEXT NOT NULL UNIQUE,
      alert_id        TEXT,
      severity        TEXT,
      report_json     TEXT NOT NULL,
      generated_at    TEXT NOT NULL,
      generated_by    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_incident_reports_inspection
      ON incident_reports(inspection_id);
    CREATE INDEX IF NOT EXISTS idx_incident_reports_generated
      ON incident_reports(generated_at DESC);
  `);

  // ── Hardware telemetry traceability (Phase 6A: ESP32 gateway) ──────────────
  // Nullable + additive: every pre-existing reading row keeps working.
  try { db.exec("ALTER TABLE sensor_readings ADD COLUMN source TEXT"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE sensor_readings ADD COLUMN device_id TEXT"); } catch { /* exists */ }
  // Provenance lookups (latest reading per sensor) scan this table — with
  // 400k+ rows the GROUP BY needs a COVERING index to stay in milliseconds
  // (grouping + MAX + source/device_id all served from the index, no table
  // visits, no sort).
  try { db.exec("DROP INDEX IF EXISTS idx_sr_sensor_time"); } catch { /* ignore */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_sr_sensor_time_cov ON sensor_readings(sensor_id, recorded_at, source, device_id)"); } catch { /* exists */ }

  // ── First hardware device registration (Phase 6A) ──────────────────────────
  // INSERT OR IGNORE so re-runs and existing databases are untouched.
  // Coordinates default to the main operating area; override with
  // ESP32_DEVICE_LAT / ESP32_DEVICE_LNG (never hard-code deployment GPS
  // in firmware — firmware only carries them as build-time config).
  try {
    const lat = Number(process.env.ESP32_DEVICE_LAT ?? 18.0);
    const lng = Number(process.env.ESP32_DEVICE_LNG ?? -77.0);
    db.prepare(
      `INSERT OR IGNORE INTO sensors
         (id, name, type, lat, lng, online, status, updated_at, last_reading_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "esp32_001", "DeepSea ESP32 Station 001", "temperature",
      Number.isFinite(lat) ? lat : 18.0, Number.isFinite(lng) ? lng : -77.0,
      0, "offline", new Date().toISOString(), "{}"
    );
  } catch { /* registration is best-effort at boot */ }
}
