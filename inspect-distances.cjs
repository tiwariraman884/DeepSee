const Database = require("./backend/node_modules/better-sqlite3");
const db = new Database("./.data/deepsea.db", { readonly: true });

const drones = db.prepare("SELECT id, name, lat, lng, battery, status FROM drones").all();
const sensors = db.prepare("SELECT id, name, lat, lng, status FROM sensors WHERE online = 1").all();

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

console.log("Nearest eligible drone distance per online sensor (eligibility: battery>=25, status idle/active):");
const eligible = drones.filter((d) => d.status !== "offline" && d.battery >= 25);
for (const s of sensors) {
  const dists = eligible
    .map((d) => ({ name: d.name, km: haversine(s.lat, s.lng, d.lat, d.lng) }))
    .sort((a, b) => a.km - b.km);
  const best = dists[0];
  console.log(
    `${s.id.padEnd(11)} ${String(s.name).padEnd(24)} (${String(s.lat).padStart(6)},${String(s.lng).padStart(7)})  nearest=${String(best?.name).padEnd(15)} ${best ? best.km.toFixed(1) : "-"} km`
  );
}
db.close();