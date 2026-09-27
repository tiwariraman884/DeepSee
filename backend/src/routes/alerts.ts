import { Router } from "express";
import { getDb } from "../db";

const router = Router();

router.get("/", (req, res) => {
  const type = req.query.type as string;
  const resolved = req.query.resolved as string;
  // Default to a small page: the dashboard renders every row it receives, so an
  // unbounded default meant 200 alert cards on first paint. Callers that need
  // more (e.g. the alerts page) pass an explicit ?limit=.
  const limit = Math.min(Number(req.query.limit) || 25, 1000);

  let where = ` WHERE 1=1`;
  const params: any[] = [];

  if (type && type !== "all") {
    where += ` AND type = ?`;
    params.push(type);
  }
  if (resolved !== undefined) {
    where += ` AND resolved = ?`;
    params.push(resolved === "true" ? 1 : 0);
  }

  try {
    const db = getDb();
    // Report the true match count independently of the page size, so the UI can
    // say "showing 25 of 1029" instead of implying only 25 exist.
    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM alerts${where}`).get(...params) as any;
    const rows = db
      .prepare(`SELECT * FROM alerts${where} ORDER BY timestamp DESC LIMIT ?`)
      .all(...params, limit) as any[];
    const mapped = rows.map(r => ({
      id: r.id, type: r.type, message: r.message,
      location: r.location, timestamp: r.timestamp,
      read: r.read === 1, resolved: r.resolved === 1,
      category: r.category, relatedEntity: r.related_entity,
      createdAt: r.created_at
    }));
    return res.json({ alerts: mapped, total: totalRow.count, limit, returned: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
