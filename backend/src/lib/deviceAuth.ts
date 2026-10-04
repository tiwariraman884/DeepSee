/**
 * Device Authentication (Phase 6A — ESP32 gateway).
 * ============================================================
 * Dedicated credentials for hardware devices, separate from the
 * general-purpose user/API-key auth in `requireAuth` (which is untouched).
 *
 *   Headers:  X-Device-Id:  esp32_001
 *             X-Device-Key:  <secret>
 *
 * Device credentials are configured server-side via environment:
 *
 *   ESP32_DEVICE_KEYS="esp32_001:<secret>,esp32_002:<secret>"
 *
 * (single-device shortcut: ESP32_DEVICE_KEY=<secret> registers esp32_001).
 *
 * Secrets are NEVER stored in SQLite. Comparison is constant-time.
 *
 * Errors follow project conventions:
 *   401 — missing credentials
 *   403 — unknown device, wrong key, or disabled device
 */
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export interface DeviceIdentity {
  kind: "device";
  deviceId: string;
}

function parseDeviceKeys(): Map<string, string> {
  const map = new Map<string, string>();
  const multi = (process.env.ESP32_DEVICE_KEYS ?? "").trim();
  for (const pair of multi.split(",")) {
    const idx = pair.indexOf(":");
    if (idx > 0) {
      const id = pair.slice(0, idx).trim();
      const key = pair.slice(idx + 1).trim();
      if (id && key) map.set(id, key);
    }
  }
  // Single-device shortcut for the first milestone device.
  const single = (process.env.ESP32_DEVICE_KEY ?? "").trim();
  if (single && !map.has("esp32_001")) map.set("esp32_001", single);
  return map;
}

/** Constant-time secret comparison (length-safe). */
function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function getDeviceIdentity(req: Request): DeviceIdentity | null {
  const deviceId = String(req.headers["x-device-id"] ?? "").trim();
  const deviceKey = String(req.headers["x-device-key"] ?? "");
  if (!deviceId || !deviceKey) return null;
  const configured = parseDeviceKeys().get(deviceId);
  // Unknown device or wrong key — same outcome, no oracle.
  if (!configured || !secretsEqual(deviceKey, configured)) return null;
  return { kind: "device", deviceId };
}

export function deviceAuth(req: Request, res: Response, next: NextFunction): void {
  const deviceId = String(req.headers["x-device-id"] ?? "").trim();
  const deviceKey = String(req.headers["x-device-key"] ?? "");
  if (!deviceId || !deviceKey) {
    res.status(401).json({ error: "Device credentials required" });
    return;
  }
  const identity = getDeviceIdentity(req);
  if (!identity) {
    res.status(403).json({ error: "Invalid device credentials" });
    return;
  }
  (req as any).device = identity;
  next();
}
