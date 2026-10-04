import { Router } from "express";
import { getDb } from "../db";
import { requireAuth, requireAdmin } from "../lib/authMiddleware";
import { validate } from "../lib/validate";
import { settingsPatchSchema } from "../lib/validation";

const router = Router();

const DEFAULT_SETTINGS = {
  profile: { fullName: "DeepSea Admin", email: "admin@deepsea.io", organization: "DeepSea Research Lab", avatar: "" },
  notifications: { critical: true, weeklyDigest: true, droneUpdates: false, emergency: true, oceanHealth: false, speciesMonitoring: false, aiRecommendations: true, missionStatus: false, email: true, push: true, sms: false },
  region: "Coral Triangle",
  theme: "dark",
};

function getUserIdFromReq(req: any, db: any): string {
  const user = req.user;
  if (user?.id) return user.id;
  const token = req.cookies?.["auth-token"] || req.cookies?.session_token;
  if (token) {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        if (payload.id) return payload.id;
      }
    } catch {}
  }
  try {
    const admin = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@deepsea.io") as any;
    if (admin?.id) return admin.id;
  } catch {}
  return "u-admin-001";
}

function getMergedSettings(db: any, userId: string) {
  const user = db.prepare("SELECT * FROM users WHERE id = ? OR email = ?").get(userId, "admin@deepsea.io") as any;
  const row = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(userId) as any;
  let saved: any = {};
  if (row?.settings_json) { try { saved = JSON.parse(row.settings_json); } catch {} }

  return {
    profile: { ...DEFAULT_SETTINGS.profile, ...(saved.profile || {}), fullName: saved?.profile?.fullName || user?.name || DEFAULT_SETTINGS.profile.fullName, email: saved?.profile?.email || user?.email || DEFAULT_SETTINGS.profile.email },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(saved.notifications || {}) },
    region: saved.region || DEFAULT_SETTINGS.region,
    theme: saved.theme || DEFAULT_SETTINGS.theme,
  };
}

router.get("/", requireAuth, (req, res) => {
  try {
    const db = getDb();
    const userId = getUserIdFromReq(req, db);
    return res.json(getMergedSettings(db, userId));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/", requireAdmin, validate(settingsPatchSchema), (req, res) => {
  try {
    const db = getDb();
    const userId = getUserIdFromReq(req, db);
    const current = getMergedSettings(db, userId);
    const patch = req.body;

    const nextProfile = { ...current.profile, ...(patch.profile || {}) };
    const nextNotifications = { ...current.notifications, ...(patch.notifications || {}) };
    const nextRegion = patch.region !== undefined ? patch.region : current.region;
    const nextTheme = patch.theme !== undefined ? patch.theme : current.theme;

    const nextSettings = { profile: nextProfile, notifications: nextNotifications, region: nextRegion, theme: nextTheme };

    if (patch.profile) {
      if (patch.profile.fullName) db.prepare("UPDATE users SET name = ? WHERE id = ?").run(patch.profile.fullName, userId);
      if (patch.profile.email) { try { db.prepare("UPDATE users SET email = ? WHERE id = ?").run(patch.profile.email, userId); } catch {} }
    }

    const jsonStr = JSON.stringify(nextSettings);
    const exists = db.prepare("SELECT user_id FROM user_settings WHERE user_id = ?").get(userId);
    if (exists) {
      db.prepare("UPDATE user_settings SET settings_json = ?, updated_at = datetime('now') WHERE user_id = ?").run(jsonStr, userId);
    } else {
      db.prepare("INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, datetime('now'))").run(userId, jsonStr);
    }

    return res.json(nextSettings);
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

router.put("/", requireAdmin, (req, res, next) => {
  (req as any).method = "PATCH";
  (router as any).handle(req, res, next);
});

router.post("/export", requireAuth, (req, res) => {
  try {
    const db = getDb();
    const userId = getUserIdFromReq(req, db);
    const data = getMergedSettings(db, userId);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="deepsea-settings-${Date.now()}.json"`);
    return res.send(JSON.stringify(data, null, 2));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/reset", requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const userId = getUserIdFromReq(req, db);
    db.prepare("INSERT OR REPLACE INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, datetime('now'))").run(userId, JSON.stringify(DEFAULT_SETTINGS));
    return res.json(DEFAULT_SETTINGS);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
