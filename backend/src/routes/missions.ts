import { Router } from "express";
import { getDb } from "../db";

const router = Router();

router.get("/", (req, res) => {
  const status = req.query.status as string;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  let query = `SELECT * FROM missions WHERE 1=1`;
  const params: any[] = [];

  if (status && status !== "all") {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY started_at DESC LIMIT ?`;
  params.push(limit);

  try {
    const db = getDb();
    const rows = db.prepare(query).all(...params) as any[];
    const mapped = rows.map(r => ({
      id: r.id, droneId: r.drone_id, droneName: r.drone_name,
      name: r.name, status: r.status, progress: r.progress,
      route: r.route_json ? JSON.parse(r.route_json) : [],
      startedAt: r.started_at, objective: r.objective, coverage: r.coverage
    }));
    return res.json({ missions: mapped, total: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
