import { Router } from "express";
import { getDb } from "../db";
import { requireAuth } from "../lib/authMiddleware";

const router = Router();

router.get("/overview", requireAuth, (req, res) => {
  try {
    const db = getDb();

    const pollutionCount = db.prepare("SELECT COUNT(*) as count FROM pollution_events WHERE status = 'active'").get() as any;
    const speciesCount = db.prepare("SELECT COUNT(*) as count FROM species").get() as any;
    const sensorsCount = db.prepare("SELECT COUNT(*) as count FROM sensors WHERE online = 1").get() as any;
    const alertsCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE resolved = 0").get() as any;
    const dronesActive = db.prepare("SELECT COUNT(*) as count FROM drones WHERE status = 'active'").get() as any;

    // Compute real ocean health from actual data
    const pollutionRows = db.prepare("SELECT severity FROM pollution_events WHERE status = 'active'").all() as any[];
    const speciesRows = db.prepare("SELECT conservation, population_trend FROM species").all() as any[];
    const sensorRows = db.prepare("SELECT online, last_reading_json FROM sensors").all() as any[];

    const avgSeverity = pollutionRows.length > 0
      ? pollutionRows.reduce((s: number, r: any) => s + r.severity, 0) / pollutionRows.length
      : 0;
    const pollutionScore = Math.max(0, 100 - avgSeverity * 10);

    const statusWeight: Record<string, number> = { stable: 1, vulnerable: 0.6, endangered: 0.3 };
    const bioScore = speciesRows.length > 0
      ? speciesRows.reduce((s: number, r: any) => {
          const base = statusWeight[r.conservation] ?? 0.5;
          const adj = r.population_trend === "increasing" ? 0.1 : r.population_trend === "decreasing" ? -0.1 : 0;
          return s + Math.max(0, Math.min(100, (base + adj) * 100));
        }, 0) / speciesRows.length
      : 100;

    const onlineRatio = sensorRows.length > 0
      ? sensorRows.filter((r: any) => r.online === 1).length / sensorRows.length
      : 1;

    const oceanHealth = Math.round(pollutionScore * 0.3 + bioScore * 0.3 + onlineRatio * 100 * 0.4);

    return res.json({
      oceanHealth,
      pollutionHotspots: pollutionCount.count,
      speciesTracked: speciesCount.count,
      sensorsOnline: sensorsCount.count,
      alerts: alertsCount.count,
      dronesActive: dronesActive.count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
