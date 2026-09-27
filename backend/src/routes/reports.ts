import { Router } from "express";
import { getDb } from "../db";

const router = Router();

function ensureReportsSeeded(db: any) {
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM reports").get() as any;
    if (row && row.count === 0) {
      const insert = db.prepare(`
        INSERT INTO reports (id, title, content, author_id, status, tags_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        "rep_001",
        "Pacific Gyre Microplastic Density Analysis",
        "Comprehensive survey of microplastic accumulation across the North Pacific Subtropical Convergence Zone.",
        "u-admin-001",
        "published",
        JSON.stringify(["Pacific", "Microplastics", "Gyre", "Q2-2026"]),
        "2026-07-18T14:30:00Z"
      );
      insert.run(
        "rep_002",
        "Coral Triangle Bleaching Early Warning",
        "Satellite thermal anomaly data and in-situ CTD profiles indicate rising bleaching vulnerability in shallow reef flats.",
        "u-admin-001",
        "published",
        JSON.stringify(["Coral", "Bleaching", "Thermal", "Indian-Ocean"]),
        "2026-07-17T09:15:00Z"
      );
      insert.run(
        "rep_003",
        "Mediterranean Illegal Discharge Incident Log",
        "Drone Sentinel-04 telemetry matched with AIS vessel tracking identified unauthorized bunker wash discharge.",
        "u-admin-001",
        "published",
        JSON.stringify(["Discharge", "Surveillance", "Enforcement"]),
        "2026-07-16T18:45:00Z"
      );
    }
  } catch {}
}

router.get("/", (req, res) => {
  const status = req.query.status as string;
  const authorId = req.query.authorId as string;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  try {
    const db = getDb();
    ensureReportsSeeded(db);

    let query = `SELECT * FROM reports WHERE 1=1`;
    const params: any[] = [];

    if (status && status !== "all") {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (authorId) {
      query += ` AND author_id = ?`;
      params.push(authorId);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];
    const mapped = rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      authorId: r.author_id,
      createdAt: r.created_at,
      status: r.status,
      tags: r.tags_json ? JSON.parse(r.tags_json) : []
    }));
    return res.json({ reports: mapped, total: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
