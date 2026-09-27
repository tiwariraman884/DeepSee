import { Router } from "express";
import { getDb } from "../db";

const router = Router();

router.get("/trends", (req, res) => {
  // Mock analytics response based on DB sizes or static calculation for now
  try {
    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as count FROM pollution_events").get() as any;
    
    // Simulate some trend data based on record count
    const trendData = Array.from({ length: 6 }).map((_, i) => ({
      date: new Date(Date.now() - (5 - i) * 86400000).toISOString().split('T')[0],
      pollution: Math.round(count.count * (1 + (Math.random() - 0.5) * 0.2)),
      healthScore: 70 + Math.round(Math.random() * 10)
    }));
    
    return res.json({ trends: trendData });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
