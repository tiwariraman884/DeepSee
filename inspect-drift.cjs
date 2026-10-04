const Database = require("./backend/node_modules/better-sqlite3");
const db = new Database("./.data/deepsea.db", { readonly: true });

console.log("=== current drone rows (DB) ===");
for (const x of db.prepare("SELECT id, name, lat, lng, status, last_update FROM drones ORDER BY id").all()) {
  console.log(`${x.id.padEnd(10)} ${String(x.name).padEnd(16)} lat=${String(x.lat).padStart(7)} lng=${String(x.lng).padStart(8)} ${String(x.status).padEnd(9)} ${x.last_update}`);
}

console.log("\n=== most recent completions (drone, sensor, time) ===");
for (const x of db.prepare("SELECT drone_id, drone_name, sensor_id, sensor_name, phase, target_lat, target_lng, completed_at FROM drone_inspections WHERE phase='complete' ORDER BY started_at DESC LIMIT 6").all()) {
  console.log(`${String(x.drone_name).padEnd(15)} -> ${String(x.sensor_name).padEnd(22)} target=(${x.target_lat},${x.target_lng})  completed=${x.completed_at}`);
}
db.close();