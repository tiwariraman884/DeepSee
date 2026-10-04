const Database = require("./backend/node_modules/better-sqlite3");
const db = new Database("./.data/deepsea.db", { readonly: true });
const rows = db
  .prepare(
    "SELECT id, drone_id, origin_lat, origin_lng, target_lat, target_lng, route_json, progress, phase FROM drone_inspections ORDER BY started_at DESC LIMIT 3"
  )
  .all();
for (const x of rows) {
  console.log("----", x.id, "phase:", x.phase, "progress:", x.progress);
  console.log("drone:", x.drone_id, "origin:", x.origin_lat, x.origin_lng, "target:", x.target_lat, x.target_lng);
  let p = [];
  try { p = JSON.parse(x.route_json); } catch { p = []; }
  console.log("pathPoints:", p.length);
  if (p.length) {
    console.log("first:", JSON.stringify(p[0]));
    console.log("second:", JSON.stringify(p[1] ?? null));
    console.log("last:", JSON.stringify(p[p.length - 1]));
  }
}
db.close();