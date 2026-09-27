import { Router } from "express";
import { getDb } from "../db";

const router = Router();

router.get("/overview", (req, res) => {
  try {
    const db = getDb();
    
    const pollutionCount = db.prepare("SELECT COUNT(*) as count FROM pollution_events WHERE status = 'active'").get() as any;
    const speciesCount = db.prepare("SELECT COUNT(*) as count FROM species").get() as any;
    const sensorsCount = db.prepare("SELECT COUNT(*) as count FROM sensors WHERE online = 1").get() as any;
    const alertsCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE resolved = 0").get() as any;
    
    return res.json({
      oceanHealth: 72, // Mocked baseline for dashboard
      pollutionHotspots: pollutionCount.count,
      speciesTracked: speciesCount.count,
      sensorsOnline: sensorsCount.count,
      alerts: alertsCount.count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
