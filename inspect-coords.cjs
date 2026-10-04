const Database = require("./backend/node_modules/better-sqlite3");
const db = new Database("./.data/deepsea.db", { readonly: true });

console.log("=== sensor_001 / Temp Station Alpha ===");
const s = db.prepare("SELECT id, name, lat, lng FROM sensors WHERE id = 'sensor_001'").get();
console.log(JSON.stringify(s));

console.log("\n=== drones (id, name, lat, lng) ===");
const d = db.prepare("SELECT id, name, lat, lng, status FROM drones ORDER BY id").all();
for (const x of d) console.log(`${x.id.padEnd(10)} ${String(x.name).padEnd(16)} lat=${String(x.lat).padStart(7)} lng=${String(x.lng).padStart(8)}  ${x.status}`);

console.log("\n=== how many sensors share coords with drone_007 (18,-77) ===");
const c = db.prepare("SELECT COUNT(*) n FROM sensors WHERE lat = 18 AND lng = -77").get();
console.log("sensors at (18,-77):", c.n);

db.close();