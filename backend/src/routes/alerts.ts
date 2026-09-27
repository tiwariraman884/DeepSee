import { Router } from "express";
import { getDb } from "../db";

const router = Router();

router.get("/", (req, res) => {
  const type = req.query.type as string;
  const resolved = req.query.resolved as string;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  let query = `SELECT * FROM alerts WHERE 1=1`;
  const params: any[] = [];

  if (type && type !== "all") {
    query += ` AND type = ?`;
    params.push(type);
  }
  if (resolved !== undefined) {
    query += ` AND resolved = ?`;
    params.push(resolved === "true" ? 1 : 0);
  }

  query += ` ORDER BY timestamp DESC LIMIT ?`;
  params.push(limit);

  try {
    const db = getDb();
    const rows = db.prepare(query).all(...params) as any[];
    const mapped = rows.map(r => ({
      id: r.id, type: r.type, message: r.message,
      location: r.location, timestamp: r.timestamp,
      read: r.read === 1, resolved: r.resolved === 1,
      category: r.category, relatedEntity: r.related_entity,
      createdAt: r.created_at
    }));
    return res.json({ alerts: mapped, total: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
