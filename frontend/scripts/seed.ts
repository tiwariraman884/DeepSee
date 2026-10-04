/**
 * DeepSea Guardian — Development Seed Script
 *
 * Populates the SQLite database from the existing mock data arrays.
 * DEVELOPMENT ONLY — never runs automatically in production.
 *
 * Usage:  npm run seed
 *
 * WARNING: This script CLEARS existing data before inserting seed data.
 *          Do NOT run against a production database.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

// ── Load mock data ────────────────────────────────────────────────────────────
// We import from the src/data files directly (tsx can handle TS)
import { pollution } from "../src/data/pollution.json";
import { drones } from "../src/data/drones.json";
import { missions } from "../src/data/missions.json";
import { sensors } from "../src/data/sensors.json";
import { species } from "../src/data/species.json";
import { alerts } from "../src/data/alerts.json";

// ─── DB setup ─────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), "..", ".data");
const DB_PATH = path.join(DATA_DIR, "deepsea.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log(`\n🌊 DeepSea Guardian — Development Seed`);
console.log(`   Database: ${DB_PATH}\n`);

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
  );
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    settings_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS pollution_events (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
    latitude REAL NOT NULL, longitude REAL NOT NULL, severity INTEGER NOT NULL,
    concentration REAL NOT NULL, affected_area REAL NOT NULL, region TEXT NOT NULL,
    detected_at TEXT NOT NULL, trend TEXT NOT NULL, status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_poll_severity ON pollution_events(severity);
  CREATE INDEX IF NOT EXISTS idx_poll_region ON pollution_events(region);
  CREATE INDEX IF NOT EXISTS idx_poll_status ON pollution_events(status);
  CREATE INDEX IF NOT EXISTS idx_poll_type ON pollution_events(type);
  CREATE TABLE IF NOT EXISTS drones (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL,
    battery INTEGER NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
    depth REAL NOT NULL, speed REAL NOT NULL, region TEXT NOT NULL,
    last_update TEXT NOT NULL, current_mission_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_drones_status ON drones(status);
  CREATE INDEX IF NOT EXISTS idx_drones_region ON drones(region);
  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY, drone_id TEXT NOT NULL, drone_name TEXT NOT NULL,
    name TEXT NOT NULL, status TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0,
    route_json TEXT NOT NULL DEFAULT '[]', started_at TEXT NOT NULL,
    objective TEXT NOT NULL, coverage REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
  CREATE INDEX IF NOT EXISTS idx_missions_drone_id ON missions(drone_id);
  CREATE TABLE IF NOT EXISTS sensors (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
    lat REAL NOT NULL, lng REAL NOT NULL, online INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'online', updated_at TEXT NOT NULL,
    last_reading_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS idx_sensors_type ON sensors(type);
  CREATE INDEX IF NOT EXISTS idx_sensors_status ON sensors(status);
  CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sensor_id TEXT NOT NULL,
    ph REAL, temp REAL, salinity REAL, oxygen REAL, turbidity REAL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sr_sensor ON sensor_readings(sensor_id);
  CREATE INDEX IF NOT EXISTS idx_sr_time ON sensor_readings(recorded_at);
  CREATE TABLE IF NOT EXISTS species (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, scientific_name TEXT NOT NULL,
    status TEXT NOT NULL, category TEXT NOT NULL, conservation TEXT NOT NULL,
    image TEXT, population_json TEXT NOT NULL DEFAULT '[]',
    population_trend TEXT NOT NULL, habitat TEXT NOT NULL, region TEXT NOT NULL,
    conservation_progress INTEGER NOT NULL, threat_level TEXT NOT NULL,
    threats_json TEXT NOT NULL DEFAULT '[]', lat REAL NOT NULL, lng REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_species_status ON species(status);
  CREATE INDEX IF NOT EXISTS idx_species_category ON species(category);
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, message TEXT NOT NULL,
    location TEXT NOT NULL, timestamp TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0, resolved INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL, related_entity TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
  CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
`);

// ── Seed transaction ──────────────────────────────────────────────────────────
const seed = db.transaction(() => {
  // Clear existing seed data (idempotent)
  db.prepare("DELETE FROM alerts").run();
  db.prepare("DELETE FROM sensor_readings").run();
  db.prepare("DELETE FROM sensors").run();
  db.prepare("DELETE FROM species").run();
  db.prepare("DELETE FROM pollution_events").run();
  db.prepare("DELETE FROM missions").run();
  db.prepare("DELETE FROM drones").run();

  // Seed demo admin user (if not exists)
  const existingAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@deepsea.io");
  if (!existingAdmin) {
    // Fail loudly rather than falling back to a default. A fallback here means
    // an admin account gets created with a publicly known password, so seeding
    // must abort instead of silently minting a privileged credential.
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminPass) {
      throw new Error("ADMIN_PASSWORD must be set before seeding an admin account.");
    }
    const hash = bcrypt.hashSync(adminPass, 12);
    db.prepare(`
      INSERT INTO users (id, name, email, password, role, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run("u-admin-001", "DeepSea Admin", "admin@deepsea.io", hash, "admin");
    console.log("  ✅ Demo admin created: admin@deepsea.io / (ADMIN_PASSWORD from env)");
  }

  // Seed pollution events
  const insertPollution = db.prepare(`
    INSERT INTO pollution_events
      (id, name, type, latitude, longitude, severity, concentration, affected_area, region, detected_at, trend, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of pollution) {
    insertPollution.run(
      p.id, p.name, p.type, p.latitude, p.longitude,
      p.severity, p.concentration, p.affectedArea, p.region,
      p.detectedAt, p.trend, p.status
    );
  }
  console.log(`  ✅ Seeded ${pollution.length} pollution events`);

  // Seed drones
  const insertDrone = db.prepare(`
    INSERT INTO drones (id, name, status, battery, lat, lng, depth, speed, region, last_update, current_mission_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const d of drones) {
    insertDrone.run(
      d.id, d.name, d.status, d.battery,
      d.position.lat, d.position.lng,
      d.depth, d.speed, d.region,
      d.lastUpdate, d.currentMission ?? null
    );
  }
  console.log(`  ✅ Seeded ${drones.length} drones`);

  // Seed missions
  const insertMission = db.prepare(`
    INSERT INTO missions (id, drone_id, drone_name, name, status, progress, route_json, started_at, objective, coverage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const m of missions) {
    insertMission.run(
      m.id, m.droneId, m.droneName, m.name,
      m.status, m.progress, JSON.stringify(m.route),
      m.startedAt, m.objective, m.coverage
    );
  }
  console.log(`  ✅ Seeded ${missions.length} missions`);

  // Seed sensors + their readings
  const insertSensor = db.prepare(`
    INSERT INTO sensors (id, name, type, lat, lng, online, status, updated_at, last_reading_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertReading = db.prepare(`
    INSERT INTO sensor_readings (sensor_id, ph, temp, salinity, oxygen, turbidity, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of sensors) {
    insertSensor.run(
      s.id, s.name, s.type,
      s.coordinates.lat, s.coordinates.lng,
      s.online ? 1 : 0, s.status, s.updatedAt,
      JSON.stringify(s.lastReading)
    );
    // Add the last reading as a time-series point
    const r = s.lastReading;
    insertReading.run(
      s.id,
      r.ph ?? null, r.temp ?? null, r.salinity ?? null,
      r.oxygen ?? null, r.turbidity ?? null,
      s.updatedAt
    );
  }
  console.log(`  ✅ Seeded ${sensors.length} sensors + readings`);

  // Seed species
  const insertSpecies = db.prepare(`
    INSERT INTO species
      (id, name, scientific_name, status, category, conservation, image,
       population_json, population_trend, habitat, region,
       conservation_progress, threat_level, threats_json, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of species) {
    insertSpecies.run(
      s.id, s.name, s.scientificName, s.status, s.category, s.conservation,
      s.image ?? null, JSON.stringify(s.population), s.populationTrend,
      s.habitat, s.region, s.conservationProgress, s.threatLevel,
      JSON.stringify(s.threats), s.coordinates.lat, s.coordinates.lng
    );
  }
  console.log(`  ✅ Seeded ${species.length} species`);

  // Seed alerts
  const insertAlert = db.prepare(`
    INSERT INTO alerts (id, type, message, location, timestamp, read, resolved, category, related_entity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of alerts) {
    insertAlert.run(
      a.id, a.type, a.message, a.location, a.timestamp,
      a.read ? 1 : 0, a.resolved ? 1 : 0,
      a.category, a.relatedEntity ?? null
    );
  }
  console.log(`  ✅ Seeded ${alerts.length} alerts`);
});

seed();

db.close();
console.log("\n🌊 Seed complete! DeepSea Guardian database is ready.\n");
