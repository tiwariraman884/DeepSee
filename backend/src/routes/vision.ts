/**
 * Vision camera API (Phase 6D).
 * ============================================================
 * Status, frame metadata/bytes, and ROV availability — all authenticated.
 * Only actually persisted frames are exposed; raw filesystem paths never
 * leave the backend. No fake connected states: unavailable adapters report
 * machine-readable error codes.
 */
import { Router } from "express";
import { getDb } from "../db";
import { requireAuth } from "../lib/authMiddleware";
import { visionPipeline } from "../lib/vision/pipeline";
import { ensureVisionSource, peekManagedSource, switchVisionSource } from "../lib/vision/runtime";
import { VisionError } from "../lib/vision/types";
import { LocalVisionFrameStorage } from "../lib/vision/storage";
import { emptyRovTelemetry } from "../lib/vision/types";

const router = Router();

const FRAME_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function frameRowToJson(r: any) {
  return {
    frameId: r.id,
    inspectionId: r.inspection_id,
    sourceType: r.source_type,
    sourceDeviceId: r.source_device_id,
    cameraId: r.camera_id,
    sequenceNumber: r.sequence_number,
    capturedAt: r.captured_at,
    width: r.width,
    height: r.height,
    mimeType: r.mime_type,
    qualityStatus: r.quality_status,
    brightness: r.brightness,
    sharpness: r.sharpness,
    processingStatus: r.processing_status,
    inferenceMs: r.inference_ms,
  };
}

router.get("/status", requireAuth, async (_req, res) => {
  try {
    const source = await ensureVisionSource();
    const st = source.getStatus();
    const c = visionPipeline.getCounters();
    return res.json({
      enabled: (process.env.VISION_ENABLED ?? "true").toLowerCase() !== "false",
      sourceType: st.sourceType,
      state: st.state,
      cameraId: st.cameraId,
      connected: st.connected,
      errorCode: st.errorCode ?? null,
      errorDetail: st.errorDetail ?? null,
      capabilities: st.capabilities,
      deviceInfo: (st as any).deviceInfo ?? null,
      captureStats: (st as any).captureStats ?? null,
      framesCaptured: c.framesCaptured,
      framesProcessed: c.framesProcessed,
      framesDropped: c.framesDropped,
      queueDepth: c.queueDepth,
      avgInferenceMs: c.avgInferenceMs,
      lastFrameAt: c.lastFrameAt,
      lastQualityStatus: c.lastQualityStatus,
      measuredFps: c.measuredFps,
      cameraConnected: st.connected,
      rovTelemetryAvailable: false,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to read vision status" });
  }
});

router.get("/frames", requireAuth, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM vision_frames ORDER BY captured_at DESC LIMIT ?`
    ).all(limit) as any[];
    return res.json({ frames: rows.map(frameRowToJson), total: rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/frames/:frameId", requireAuth, (req, res) => {
  const frameId = String(req.params.frameId ?? "");
  if (!FRAME_ID_RE.test(frameId)) {
    return res.status(400).json({ error: "Invalid frame ID." });
  }
  try {
    const db = getDb();
    const row = (db.prepare("SELECT * FROM vision_frames WHERE id = ?").get(frameId) as any)
      ?? (db.prepare("SELECT * FROM vision_frames WHERE id LIKE ? ORDER BY captured_at DESC LIMIT 1").get(`%__${frameId}`) as any);
    if (!row) return res.status(404).json({ error: "Frame not found." });
    return res.json({ frame: frameRowToJson(row) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/frames/:frameId/file", requireAuth, (req, res) => {
  const frameId = String(req.params.frameId ?? "");
  if (!FRAME_ID_RE.test(frameId)) {
    return res.status(400).json({ error: "Invalid frame ID." });
  }
  try {
    const storage = new LocalVisionFrameStorage();
    const found = storage.getFrame(frameId);
    if (!found) return res.status(404).json({ error: "Frame bytes not found." });
    res.setHeader("Content-Type", found.mimeType);
    res.setHeader("Content-Length", String(found.bytes.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(found.bytes);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to read frame bytes." });
  }
});

router.get("/rov/status", requireAuth, (_req, res) => {
  // No ROV hardware is present — honest unavailability only.
  return res.json({
    available: false,
    connected: false,
    sourceType: "ROV_CAMERA",
    telemetryAvailable: false,
    telemetry: emptyRovTelemetry(),
    managedSource: peekManagedSource()?.sourceType ?? null,
  });
});

// Explicit source switching. Hardware targets that are unavailable REJECT
// the switch — the previous source stays active. Silent fallback is forbidden.
router.post("/source", requireAuth, async (req, res) => {
  const kind = String(req.body?.source ?? "");
  if (!kind) {
    return res.status(400).json({ error: "Missing 'source' in request body." });
  }
  try {
    const status = await switchVisionSource(kind);
    return res.json({ switched: true, status });
  } catch (err: any) {
    if (err instanceof VisionError && err.message.startsWith("Unknown vision source")) {
      return res.status(400).json({ error: err.message });
    }
    const code = err instanceof VisionError ? err.code : "CAMERA_STREAM_UNAVAILABLE";
    return res.status(409).json({
      switched: false,
      error: err?.message ?? "Source switch rejected.",
      code,
    });
  }
});

export default router;
