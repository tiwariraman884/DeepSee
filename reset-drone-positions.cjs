/**
 * Reset drone rows to the canonical seed positions from frontend/src/data/drones.json.
 * Non-destructive to every other table (users, inspections, evidence, alerts, ...).
 *
 * Why: `inspectionSimulator.completeInspection` used to leave each drone parked on
 * the sensor it just inspected ("lat = targetLat, lng = targetLng"), so the fleet
 * drifted onto sensor coordinates and later dispatches became 0 km — the map marker
 * never moved. The simulator is now fixed to send drones home; this script heals the
 * already-drifted rows.
 *
 * Usage: node reset-drone-positions.cjs
 */
const Database = require("./backend/node_modules/better-sqlite3");
const path = require("path");

// Load the canonical seed positions. drones.json.ts is TS, so parse the array out
// of the two source files instead of importing them.
const fs = require("fs");
const tsSrc = fs.readFileSync(
  path.join(__dirname, "frontend", "src", "data", "drones.json.ts"),
  "utf-8"
);

// Extract "id", status/battery and position {lat,lng} per drone block.
const drones = [];
const blocks = tsSrc.split(/\n\s*\{\s*\n/).slice(1);
for (const b of blocks) {
  const id = /id:\s*"([^"]+)"/.exec(b)?.[1];
  const status = /status:\s*"([^"]+)"/.exec(b)?.[1];
  const battery = /battery:\s*(\d+)/.exec(b)?.[1];
  const lat = /position:\s*\{\s*lat:\s*(-?[\d.]+)/.exec(b)?.[1];
  const lng = /lng:\s*(-?[\d.]+)/.exec(b)?.[1];
  const region = /region:\s*"([^"]+)"/.exec(b)?.[1];
  if (id && lat && lng) {
    drones.push({ id, status, battery: Number(battery), lat: Number(lat), lng: Number(lng), region });
  }
}

if (drones.length === 0) {
  console.error("Could not parse any drones from drones.json.ts — aborting.");
  process.exit(1);
}

const db = new Database(path.join(__dirname, ".data", "deepsea.db"));
db.pragma("journal_mode = WAL");

const update = db.prepare(
  "UPDATE drones SET status = ?, battery = ?, lat = ?, lng = ?, region = ?, last_update = ? WHERE id = ?"
);
const now = new Date().toISOString();

const tx = db.transaction(() => {
  for (const d of drones) {
    update.run(d.status, d.battery, d.lat, d.lng, d.region, now, d.id);
  }
});
tx();

console.log(`Reset ${drones.length} drone(s) to canonical seed positions:`);
for (const d of drones) {
  console.log(`  ${d.id.padEnd(10)} ${String(d.lat).padStart(7)},${String(d.lng).padStart(8)}  ${d.status}`);
}
db.close();