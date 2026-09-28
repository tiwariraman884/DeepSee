import { Router } from "express";
import { getDb } from "../db";
import PDFDocument from "pdfkit";
import { requireAuth } from "../lib/authMiddleware";

const router = Router();

function ensureReportsSeeded(db: any) {
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM reports").get() as any;
    if (row && row.count === 0) {
      const insert = db.prepare(
        `INSERT INTO reports (id, title, content, author_id, status, tags_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      insert.run("rep_001", "Pacific Gyre Microplastic Density Analysis",
        "Comprehensive survey of microplastic accumulation across the North Pacific Subtropical Convergence Zone.",
        "u-admin-001", "published", JSON.stringify(["Pacific", "Microplastics", "Gyre", "Q2-2026"]), "2026-07-18T14:30:00Z");
      insert.run("rep_002", "Coral Triangle Bleaching Early Warning",
        "Satellite thermal anomaly data and in-situ CTD profiles indicate rising bleaching vulnerability in shallow reef flats.",
        "u-admin-001", "published", JSON.stringify(["Coral", "Bleaching", "Thermal", "Indian-Ocean"]), "2026-07-17T09:15:00Z");
      insert.run("rep_003", "Mediterranean Illegal Discharge Incident Log",
        "Drone Sentinel-04 telemetry matched with AIS vessel tracking identified unauthorized bunker wash discharge.",
        "u-admin-001", "published", JSON.stringify(["Discharge", "Surveillance", "Enforcement"]), "2026-07-16T18:45:00Z");
    }
  } catch {}
}

router.get("/download", requireAuth, (req, res) => {
  try {
    const db = getDb();
    const recentAlerts = db.prepare(
      `SELECT * FROM alerts WHERE type IN ('critical', 'warning') ORDER BY created_at DESC LIMIT 5`
    ).all() as any[];
    const activeDrones = db.prepare("SELECT COUNT(*) as count FROM drones WHERE status = 'active'").get() as any;
    const totalDrones = db.prepare("SELECT COUNT(*) as count FROM drones").get() as any;

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Disposition", 'attachment; filename="DeepSea_Guardian_Report.pdf"');
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    doc.fontSize(24).font("Helvetica-Bold").fillColor("#059669").text("DeepSea Guardian", { align: "center" });
    doc.fontSize(14).fillColor("#64748B").text("Ocean Health & AI Anomalies Report", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(10).fillColor("#333333").text(`Generated on: ${new Date().toLocaleString()}`);
    doc.text(`Fleet Status: ${activeDrones.count} of ${totalDrones.count} drones currently active in the field.`);
    doc.moveDown(2);

    doc.fontSize(18).font("Helvetica-Bold").fillColor("#0F172A").text("Recent Critical Alerts");
    doc.moveDown(1);
    if (recentAlerts.length === 0) {
      doc.fontSize(12).font("Helvetica").fillColor("#10B981").text("No critical alerts detected recently. Oceans are stable.");
    } else {
      recentAlerts.forEach((alert) => {
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#EF4444").text(`[${alert.type.toUpperCase()}] ${alert.category} Alert at ${alert.location}`);
        doc.fontSize(10).font("Helvetica").fillColor("#475569").text(`Time: ${new Date(alert.created_at).toLocaleString()}`);
        doc.fontSize(11).fillColor("#1E293B").text(`${alert.message}`);
        doc.moveDown(1);
      });
    }

    doc.moveDown(2);
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#0F172A").text("AI Spread Forecast Insights");
    doc.fontSize(11).font("Helvetica").fillColor("#333333").text("Current trajectory models indicate stable dispersion with isolated risk zones. Recommend continued monitoring via autonomous Sentinel drones.");

    doc.moveDown(4);
    doc.fontSize(9).fillColor("#94A3B8").text("Generated automatically by DeepSea Guardian AI Infrastructure", { align: "center" });
    doc.end();
  } catch (err: any) {
    console.error("PDF generation error:", err);
    return res.status(500).json({ error: "Failed to generate PDF report" });
  }
});

router.get("/", requireAuth, (req, res) => {
  const status = req.query.status as string;
  const authorId = req.query.authorId as string;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  try {
    const db = getDb();
    ensureReportsSeeded(db);

    let query = `SELECT * FROM reports WHERE 1=1`;
    const params: any[] = [];
    if (status && status !== "all") { query += ` AND status = ?`; params.push(status); }
    if (authorId) { query += ` AND author_id = ?`; params.push(authorId); }
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];
    const mapped = rows.map(r => ({
      id: r.id, title: r.title, content: r.content,
      authorId: r.author_id, createdAt: r.created_at,
      status: r.status, tags: r.tags_json ? JSON.parse(r.tags_json) : []
    }));
    return res.json({ reports: mapped, total: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
