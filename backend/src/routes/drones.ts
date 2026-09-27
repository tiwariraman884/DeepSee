import { Router } from "express";
import { getDb } from "../db";

const router = Router();

router.get("/", (req, res) => {
  const region = req.query.region as string;
  const status = req.query.status as string;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  let query = `SELECT * FROM drones WHERE 1=1`;
  const params: any[] = [];

  if (region && region !== "all") {
    query += ` AND region = ?`;
    params.push(region);
  }
  if (status && status !== "all") {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY last_update DESC LIMIT ?`;
  params.push(limit);

  try {
    const db = getDb();
    const rows = db.prepare(query).all(...params) as any[];
    const mapped = rows.map(r => ({
      id: r.id, name: r.name, status: r.status, battery: r.battery,
      position: { lat: r.lat, lng: r.lng },
      depth: r.depth, speed: r.speed, region: r.region,
      lastUpdate: r.last_update, currentMission: r.current_mission_id
    }));
    return res.json({ drones: mapped, total: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/:id", (req, res) => {
  try {
    const db = getDb();
    const r = db.prepare("SELECT * FROM drones WHERE id = ?").get(req.params.id) as any;
    if (!r) return res.status(404).json({ error: "Not found" });
    return res.json({
      drone: {
        id: r.id, name: r.name, status: r.status, battery: r.battery,
        position: { lat: r.lat, lng: r.lng },
        depth: r.depth, speed: r.speed, region: r.region,
        lastUpdate: r.last_update, currentMission: r.current_mission_id
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
