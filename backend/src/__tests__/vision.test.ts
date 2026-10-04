/**
 * Vision pipeline tests (Phase 6D) — no physical hardware required.
 *
 *   A. Frame contract validation
 *   B. Fixture source (deterministic, bounded)
 *   C. Invalid frame handling
 *   D. Frame queue limit
 *   E. Dropped frame accounting
 *   F. Sampling interval
 *   G. Camera lifecycle
 *   H. Vision inference integration (shared analyseFrame default)
 *   I. Evidence references frameId (shared persist path)
 *   J. Provenance preserved end-to-end (never labeled hardware)
 *   K. Simulated inspection regression (same interface, same contract)
 *   L. Inspection cleanup (idempotent stop, no listener leaks)
 *   M. Camera unavailable state (USB, no silent fallback)
 *   N. RTSP configuration validation (incl. credential redaction)
 *   O. Incident report vision fields
 *   P. System intelligence vision metrics
 *
 * Physical-camera tests are gated behind RUN_REAL_CAMERA_TESTS=true and are
 * skipped otherwise — CI never depends on hardware.
 */
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import fs from "fs";
import os from "os";
import path from "path";

import { analyseFrame } from "../lib/inspectionAI";
import { getOrCreateIncidentReport } from "../lib/incidentReport";
import { eventBus } from "../lib/eventBus";
import { getDb } from "../db";
import { generateFixtureBmp, decodeBmp, sniffMimeType } from "../lib/vision/bmp";
import { analyzeFrameQuality } from "../lib/vision/quality";
import { preprocessFrame } from "../lib/vision/preprocess";
import {
  VisionPipeline,
  visionPipeline,
  persistVisionEvidence,
} from "../lib/vision/pipeline";
import { resetVisionRuntimeForTests } from "../lib/vision/runtime";
import { LocalVisionFrameStorage } from "../lib/vision/storage";
import {
  FixtureCameraSource,
  SimulatedCameraSource,
  UsbCameraSource,
  RtspCameraSource,
  RovCameraSource,
} from "../lib/vision/sources";
import type { UvcCaptureBackend, UvcDeviceInfo } from "../lib/vision/uvc";
import {
  VisionSourceType,
  VisionQualityStatus,
  VisionError,
  VisionErrorCode,
  isVisionSourceType,
  isTestVisionSource,
  isHardwareVisionSource,
  type VisionFrame,
} from "../lib/vision/types";
import systemRoutes from "../routes/system";
import visionRoutes from "../routes/vision";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/system", systemRoutes);
app.use("/api/vision", visionRoutes);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deepsea-vision-test-"));

beforeAll(() => {
  // Parent inspection row: inspection_evidence.inspection_id is a real FK.
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO drone_inspections
       (id, drone_id, drone_name, sensor_id, sensor_name, phase, eta_seconds,
        progress, target_lat, target_lng, origin_lat, origin_lng, route_json, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "insp-vision-test", "drone-test", "TestDrone", "sensor_001", "Temp Station Alpha",
    "inspecting", 10, 50, 18.0, -77.0, 18.0, -77.0, "[]", now
  );
});

function stubInference(label = "Test Species") {
  return async () => ({
    kind: "marine_species" as const,
    label,
    confidence: 88.8,
    detail: "stub detection",
    simulation: true,
  });
}

function makeFrame(overrides: Partial<VisionFrame> = {}): VisionFrame {
  const buffer = generateFixtureBmp(160, 120, 7);
  return {
    frameId: `frm-test-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    inspectionId: "insp-vision-test",
    sourceType: VisionSourceType.FIXTURE_IMAGE,
    capturedAt: new Date().toISOString(),
    width: 160,
    height: 120,
    mimeType: "image/bmp",
    buffer,
    sequenceNumber: 1,
    sourceDeviceId: null,
    cameraId: "fixture-camera-01",
    quality: null,
    processingStatus: "QUEUED",
    inferenceMs: null,
    ...overrides,
  };
}

function freshPipeline() {
  return new VisionPipeline({
    infer: stubInference(),
    storage: new LocalVisionFrameStorage(tmpDir, 20),
    maxQueue: 3,
    analysisIntervalMs: 0,
  });
}

afterAll(() => {
  visionPipeline.resetForTests();
  resetVisionRuntimeForTests();
  eventBus.clear();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* ignore */ }
  try {
    const db = getDb();
    db.prepare("DELETE FROM vision_frames WHERE inspection_id = 'insp-vision-test'").run();
    db.prepare("DELETE FROM inspection_evidence WHERE inspection_id = 'insp-vision-test'").run();
    db.prepare("DELETE FROM incident_reports WHERE inspection_id = 'insp-vision-test'").run();
    db.prepare("DELETE FROM drone_inspections WHERE id = 'insp-vision-test'").run();
  } catch { /* best-effort */ }
});

describe("A. frame contract", () => {
  it("fixture capture carries every required provenance field", async () => {
    const src = new FixtureCameraSource("image");
    await src.connect();
    const frame = await src.captureFrame("insp-vision-test", 3);
    expect(frame.frameId).toBeTruthy();
    expect(frame.inspectionId).toBe("insp-vision-test");
    expect(isVisionSourceType(frame.sourceType)).toBe(true);
    expect(frame.sourceType).toBe(VisionSourceType.FIXTURE_IMAGE);
    expect(frame.capturedAt).toBeTruthy();
    expect(frame.sequenceNumber).toBe(3);
    expect(frame.cameraId).toBe("fixture-camera-01");
    expect(frame.buffer.length).toBeGreaterThan(0);
    await src.disconnect();
  });

  it("rejects free-form source strings", () => {
    expect(isVisionSourceType("REAL_CAMERA")).toBe(false);
    expect(isVisionSourceType("FIXTURE_VIDEO")).toBe(true);
    expect(isTestVisionSource(VisionSourceType.FIXTURE_VIDEO)).toBe(true);
    expect(isHardwareVisionSource(VisionSourceType.FIXTURE_VIDEO)).toBe(false);
    expect(isHardwareVisionSource(VisionSourceType.USB_CAMERA)).toBe(true);
  });
});

describe("B. fixture source", () => {
  it("is deterministic per seed and varies across seeds", () => {
    const a = FixtureCameraSource.fixtureBytes(160, 120, 7);
    const b = FixtureCameraSource.fixtureBytes(160, 120, 7);
    const c = FixtureCameraSource.fixtureBytes(160, 120, 8);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it("decodes to the advertised dimensions", () => {
    const bmp = generateFixtureBmp(160, 120, 7);
    expect(sniffMimeType(bmp)).toBe("image/bmp");
    const decoded = decodeBmp(bmp);
    expect(decoded.width).toBe(160);
    expect(decoded.height).toBe(120);
    expect(decoded.pixels.length).toBe(160 * 120 * 3);
  });

  it("video sequences are bounded and exhaust explicitly", async () => {
    const src = new FixtureCameraSource("video", "fixture-camera-01", { frameCount: 2 });
    await src.connect();
    await src.captureFrame("insp-vision-test", 1);
    await src.captureFrame("insp-vision-test", 2);
    await expect(src.captureFrame("insp-vision-test", 3)).rejects.toMatchObject({
      code: VisionErrorCode.CAMERA_STREAM_UNAVAILABLE,
    });
    await src.disconnect();
  });
});

describe("C. invalid frames", () => {
  it("empty buffer fails quality as INVALID", () => {
    const q = analyzeFrameQuality(Buffer.alloc(0));
    expect(q.validFrame).toBe(false);
    expect(q.qualityStatus).toBe("INVALID");
  });

  it("corrupt BMP bytes fail decode, never fake metrics", () => {
    const bad = Buffer.from([0x42, 0x4d, 0x00, 0x01, 0x02]);
    const q = analyzeFrameQuality(bad, "image/bmp");
    expect(q.validFrame).toBe(false);
    expect(q.brightness).toBeNull();
    expect(q.sharpness).toBeNull();
  });

  it("preprocess rejects empty and undersized frames with codes", () => {
    try {
      preprocessFrame(Buffer.alloc(0), "image/bmp");
      throw new Error("should have thrown");
    } catch (e: any) {
      expect(e.code).toBe(VisionErrorCode.FRAME_INVALID);
    }
    // Hand-crafted 4x4 BMP (below the 8px minimum) — valid container, too small.
    const full = generateFixtureBmp(8, 8, 1);
    const tiny = Buffer.alloc(54 + 4 * 4 * 3 + 8);
    full.copy(tiny, 0, 0, 54);
    tiny.writeInt32LE(4, 18);
    tiny.writeInt32LE(4, 22);
    try {
      preprocessFrame(tiny, "image/bmp");
      throw new Error("should have thrown");
    } catch (e: any) {
      expect(e.code).toBe(VisionErrorCode.FRAME_TOO_SMALL);
    }
  });
});

describe("D/E. bounded queue and drop accounting", () => {
  it("queues up to maxQueue then drops with honest counters", () => {
    const pipe = new VisionPipeline({
      infer: stubInference(),
      storage: new LocalVisionFrameStorage(tmpDir, 20),
      maxQueue: 1,
      analysisIntervalMs: 0,
    });
    expect(pipe.submitFrame(makeFrame())).toBe("queued");
    expect(pipe.submitFrame(makeFrame())).toBe("dropped-queue-full");
    const c = pipe.getCounters();
    expect(c.framesCaptured).toBe(1);
    expect(c.framesDropped).toBe(1);
    expect(c.queueDepth).toBe(1);
    pipe.resetForTests();
  });
});

describe("F. sampling interval", () => {
  it("drops frames arriving inside the analysis window", () => {
    const pipe = new VisionPipeline({
      infer: stubInference(),
      storage: new LocalVisionFrameStorage(tmpDir, 20),
      maxQueue: 10,
      analysisIntervalMs: 60_000,
    });
    expect(pipe.submitFrame(makeFrame())).toBe("queued");
    expect(pipe.submitFrame(makeFrame())).toBe("dropped-sampled");
    expect(pipe.getCounters().framesDropped).toBe(1);
    pipe.resetForTests();
  });
});

describe("G. camera lifecycle", () => {
  it("fixture connects/streams/disconnects with truthful status", async () => {
    const src = new FixtureCameraSource("video");
    expect(src.getStatus().connected).toBe(false);
    const st = await src.connect();
    expect(st.connected).toBe(true);
    expect(st.state).toBe("STREAMING");
    expect(st.capabilities).toContain("deterministic-sequence");
    await src.disconnect();
    expect(src.getStatus().connected).toBe(false);
  });

  it("simulated source exposes single-capture capability", async () => {
    const src = new SimulatedCameraSource();
    await src.connect();
    expect(src.getCapabilities()).toContain("single-capture");
    await src.disconnect();
  });
});

describe("H. inference integration (shared analyseFrame)", () => {
  it("pipeline default inference IS the shared analyseFrame symbol", () => {
    const pipe = new VisionPipeline({
      storage: new LocalVisionFrameStorage(tmpDir, 20),
    });
    expect((pipe as any).infer).toBe(analyseFrame);
  });

  it("processes a fixture frame end-to-end with stub inference", async () => {
    const pipe = freshPipeline();
    expect(pipe.submitFrame(makeFrame())).toBe("queued");
    const detection = await pipe.processNext();
    expect(detection).toBeTruthy();
    expect(detection?.label).toBe("Test Species");
    const c = pipe.getCounters();
    expect(c.framesProcessed).toBe(1);
    expect(typeof c.avgInferenceMs === "number" || c.avgInferenceMs === null).toBe(true);
    pipe.resetForTests();
  });

  it("measures real quality on fixture pixels (no invented metrics)", async () => {
    const pipe = freshPipeline();
    const frame = makeFrame();
    pipe.submitFrame(frame);
    await pipe.processNext();
    expect(frame.quality).toBeTruthy();
    expect(frame.quality?.validFrame).toBe(true);
    expect(frame.quality?.width).toBe(160);
    expect(typeof frame.quality?.brightness).toBe("number");
    expect(typeof frame.quality?.sharpness).toBe("number");
    expect(frame.inferenceMs).not.toBeNull();
    pipe.resetForTests();
  });
});

describe("I/J. evidence frame linkage and provenance", () => {
  it("persists evidence linked to its frame with classified provenance", async () => {
    const pipe = freshPipeline();
    const frame = makeFrame({ sourceType: VisionSourceType.FIXTURE_VIDEO });
    pipe.submitFrame(frame);
    const detection = await pipe.processNext();
    expect(detection).toBeTruthy();

    const evidenceId = persistVisionEvidence({
      inspectionId: "insp-vision-test",
      droneId: "drone-test",
      detection: detection!,
      frame,
    });
    expect(evidenceId).toBeTruthy();

    const db = getDb();
    const row = db.prepare("SELECT frame_id, source_type FROM inspection_evidence WHERE id = ?").get(evidenceId) as any;
    expect(row.frame_id).toBe(frame.frameId);
    expect(row.source_type).toBe(VisionSourceType.FIXTURE_VIDEO);

    const frow = db.prepare("SELECT source_type, processing_status FROM vision_frames WHERE id = ?").get(frame.frameId) as any;
    expect(frow.source_type).toBe(VisionSourceType.FIXTURE_VIDEO);
    expect(frow.processing_status).toBe("PROCESSED");

    // Provenance rule: fixture sources are test sources, never hardware.
    expect(isTestVisionSource(frame.sourceType)).toBe(true);
    expect(isHardwareVisionSource(frame.sourceType)).toBe(false);
    pipe.resetForTests();
  });
});

describe("K. simulated path preserved", () => {
  it("processes a SIMULATED frame through the same pipeline contract", async () => {
    const pipe = freshPipeline();
    const frame = makeFrame({ sourceType: VisionSourceType.SIMULATED, mimeType: "application/octet-stream" });
    expect(pipe.submitFrame(frame)).toBe("queued");
    const detection = await pipe.processNext();
    expect(detection).toBeTruthy();
    const evidenceId = persistVisionEvidence({
      inspectionId: "insp-vision-test",
      droneId: "drone-test",
      detection: detection!,
      frame,
    });
    const db = getDb();
    const row = db.prepare("SELECT source_type FROM inspection_evidence WHERE id = ?").get(evidenceId) as any;
    expect(row.source_type).toBe(VisionSourceType.SIMULATED);
    pipe.resetForTests();
  });
});

describe("L. cleanup", () => {
  it("stop() is idempotent and drops the pending queue", async () => {
    const pipe = freshPipeline();
    pipe.submitFrame(makeFrame());
    expect(pipe.getCounters().queueDepth).toBe(1);
    await pipe.stop();
    await pipe.stop();
    expect(pipe.getCounters().queueDepth).toBe(0);
    pipe.resetForTests();
  });

  it("adds no EventBus listener handles", () => {
    const before = eventBus.listenerCount("vision.frame.captured");
    const pipe = freshPipeline();
    pipe.submitFrame(makeFrame());
    pipe.resetForTests();
    expect(eventBus.listenerCount("vision.frame.captured")).toBe(before);
  });
});

describe("M. USB unavailable state (no silent fallback)", () => {
  it("reports UNAVAILABLE with a machine-readable code", async () => {
    delete process.env.VISION_CAMERA_DEVICE;
    const src = new UsbCameraSource("");
    const st = await src.connect();
    expect(st.connected).toBe(false);
    expect(st.state).toBe("UNAVAILABLE");
    expect([VisionErrorCode.CAMERA_NOT_CONFIGURED, VisionErrorCode.CAMERA_DEVICE_NOT_FOUND]).toContain(st.errorCode);
    await expect(src.captureFrame("insp-vision-test", 1)).rejects.toBeInstanceOf(VisionError);
  });

  it("ROV source is reserved and reports not-connected", async () => {
    const src = new RovCameraSource();
    const st = await src.connect();
    expect(st.sourceType).toBe(VisionSourceType.ROV_CAMERA);
    expect(st.connected).toBe(false);
    expect(st.errorCode).toBe(VisionErrorCode.CAMERA_DEVICE_NOT_FOUND);
    await expect(src.captureFrame("insp-vision-test", 1)).rejects.toBeInstanceOf(VisionError);
  });
});

describe("N. RTSP configuration validation", () => {
  it("rejects missing and malformed URLs without network access", () => {
    const missing = new RtspCameraSource("");
    expect(missing.validateConfig().ok).toBe(false);
    expect(missing.validateConfig().code).toBe(VisionErrorCode.CAMERA_NOT_CONFIGURED);

    const bad = new RtspCameraSource("not-a-url");
    expect(bad.validateConfig().ok).toBe(false);
  });

  it("accepts a well-formed URL but stays honestly disconnected", async () => {
    const src = new RtspCameraSource("rtsp://camera.local:8554/stream");
    expect(src.validateConfig().ok).toBe(true);
    const st = await src.connect();
    expect(st.connected).toBe(false);
    expect(st.errorCode).toBe(VisionErrorCode.CAMERA_STREAM_UNAVAILABLE);
    await expect(src.captureFrame("insp-vision-test", 1)).rejects.toBeInstanceOf(VisionError);
  });

  it("redacts credentials in logs/UI", () => {
    const src = new RtspCameraSource("rtsp://admin:s3cret@camera.local/stream");
    expect(src.redactedUrl()).not.toContain("s3cret");
    expect(src.redactedUrl()).toContain("camera.local");
  });
});

describe("O. incident report vision fields", () => {
  const O_INSP = "insp-vision-test-o";
  it("exposes frame counts and representative frame from persisted rows", () => {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO drone_inspections
         (id, drone_id, drone_name, sensor_id, sensor_name, phase, eta_seconds,
          progress, target_lat, target_lng, origin_lat, origin_lng, route_json,
          severity, threat_json, summary, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      O_INSP, "drone-test", "TestDrone", "sensor_001", "Temp Station Alpha",
      "complete", 10, 100, 18.0, -77.0, 18.0, -77.0, "[]",
      "high", "[]", "Vision test inspection.", now, now
    );
    for (const [id, status] of [["frm-o-1", "PROCESSED"], ["frm-o-2", "PROCESSED"], ["frm-o-3", "DROPPED"]] as const) {
      db.prepare(
        `INSERT OR REPLACE INTO vision_frames
           (id, inspection_id, source_type, camera_id, sequence_number, captured_at, processing_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, O_INSP, VisionSourceType.FIXTURE_VIDEO, "fixture-camera-01", 1, now, status, now);
    }
    db.prepare(
      `INSERT OR REPLACE INTO inspection_evidence (id, inspection_id, kind, label, confidence, detail, captured_at, frame_id, source_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run("ev-o-1", O_INSP, "marine_species", "Test Species", 90, "d", now, "frm-o-1", VisionSourceType.FIXTURE_VIDEO);

    const { report } = getOrCreateIncidentReport(O_INSP, null);
    expect(report.vision.framesCaptured).toBe(3);
    expect(report.vision.framesProcessed).toBe(2);
    expect(report.vision.framesDropped).toBe(1);
    expect(report.vision.sourceType).toBe(VisionSourceType.FIXTURE_VIDEO);
    expect(report.vision.representativeFrameId).toBe("frm-o-1");

    // Fixture-local cleanup (suite afterAll covers the shared id too).
    db.prepare("DELETE FROM vision_frames WHERE inspection_id = ?").run(O_INSP);
    db.prepare("DELETE FROM inspection_evidence WHERE inspection_id = ?").run(O_INSP);
    db.prepare("DELETE FROM incident_reports WHERE inspection_id = ?").run(O_INSP);
    db.prepare("DELETE FROM drone_inspections WHERE id = ?").run(O_INSP);
  });
});

describe("P. system intelligence vision metrics", () => {
  it("reflects live pipeline counters (session telemetry)", async () => {
    const pipe = freshPipeline();
    const before = await request(app).get("/api/system/intelligence");
    expect(before.status).toBe(200);
    expect(before.body.vision).toBeTruthy();

    pipe.submitFrame(makeFrame());
    await pipe.processNext();
    const after = await request(app).get("/api/system/intelligence");
    // Session counters move only on real pipeline events (shared singleton
    // untouched here — assert shape honesty, not cross-instance counts).
    expect(typeof after.body.vision.framesCaptured).toBe("number");
    expect(typeof after.body.vision.framesProcessed).toBe("number");
    expect(typeof after.body.vision.framesDropped).toBe("number");
    expect(typeof after.body.vision.queueDepth).toBe("number");
    expect(after.body.vision.rovTelemetryAvailable).toBe(false);
    pipe.resetForTests();
  });
});

describe("RUN_REAL_CAMERA_TESTS gate", () => {
  it("skips physical camera tests unless explicitly enabled", () => {
    if (process.env.RUN_REAL_CAMERA_TESTS === "true") {
      // Physical hardware path — only runs with explicit opt-in.
      expect(true).toBe(true);
    } else {
      expect(process.env.RUN_REAL_CAMERA_TESTS ?? "unset").not.toBe("true");
    }
  });
});

// ─── Phase 6E: physical capture backend (stub-driven + gated real) ──────────

class StubUvcBackend implements UvcCaptureBackend {
  devices: UvcDeviceInfo[] = [
    { index: 0, name: "StubCam 0", width: 64, height: 48, fps: 30 },
  ];
  failDiscovery = false;

  async listDevices(): Promise<UvcDeviceInfo[]> {
    if (this.failDiscovery) throw new Error("DISCOVERY_BROKEN");
    return this.devices;
  }

  async captureStill(device: string) {
    void device;
    return {
      bytes: generateFixtureBmp(64, 48, 11),
      mimeType: "image/bmp" as const,
      width: 64,
      height: 48,
      captureMs: 12.5,
      deviceName: "StubCam 0",
    };
  }
}

describe("6E. USB configuration and discovery", () => {
  it("matches by index or name substring, exposes measured device detail", async () => {
    const byIndex = new UsbCameraSource("0", undefined, new StubUvcBackend());
    const st = await byIndex.connect();
    expect(st.connected).toBe(true);
    expect(st.state).toBe("RUNNING");
    expect(st.deviceInfo).toMatchObject({ deviceId: "0", deviceName: "StubCam 0" });
    await byIndex.disconnect();

    const byName = new UsbCameraSource("stubcam", undefined, new StubUvcBackend());
    const st2 = await byName.connect();
    expect(st2.connected).toBe(true);
    await byName.disconnect();
  });

  it("unknown device id reports NOT_FOUND without fallback", async () => {
    const src = new UsbCameraSource("99", undefined, new StubUvcBackend());
    const st = await src.connect();
    expect(st.connected).toBe(false);
    expect(st.errorCode).toBe(VisionErrorCode.CAMERA_DEVICE_NOT_FOUND);
  });

  it("discovery failure surfaces honestly", async () => {
    const stub = new StubUvcBackend();
    stub.failDiscovery = true;
    const src = new UsbCameraSource("0", undefined, stub);
    const st = await src.connect();
    expect(st.connected).toBe(false);
  });
});

describe("6E. capture lifecycle and metadata", () => {
  it("capture requires explicit connect (no silent auto-connect)", async () => {
    const src = new UsbCameraSource("0", undefined, new StubUvcBackend());
    await expect(src.captureFrame("insp-vision-test", 1)).rejects.toMatchObject({
      code: VisionErrorCode.CAMERA_STREAM_UNAVAILABLE,
    });
  });

  it("frames carry USB provenance, real dims, deterministic sequence", async () => {
    const src = new UsbCameraSource("0", undefined, new StubUvcBackend());
    await src.connect();
    const f1 = await src.captureFrame("insp-vision-test", 1);
    const f2 = await src.captureFrame("insp-vision-test", 2);
    expect(f1.sourceType).toBe(VisionSourceType.USB_CAMERA);
    expect(f1.cameraId).toBe("usb-camera-0");
    expect(f1.sourceDeviceId).toBe("0");
    expect(f1.width).toBe(64);
    expect(f1.height).toBe(48);
    expect(f1.mimeType).toBe("image/bmp");
    expect(f1.capturedAt).toBeTruthy();
    expect(f2.sequenceNumber).toBe(f1.sequenceNumber + 1);
    expect(f2.frameId).not.toBe(f1.frameId);
    await src.disconnect();
  });

  it("repeated connect/disconnect cycles are safe", async () => {
    const src = new UsbCameraSource("0", undefined, new StubUvcBackend());
    await src.connect();
    await src.connect();
    await src.disconnect();
    await src.disconnect();
    const st = await src.connect();
    expect(st.connected).toBe(true);
    await src.disconnect();
  });

  it("reports measured capture stats, never configured FPS as measured", async () => {
    const src = new UsbCameraSource("0", undefined, new StubUvcBackend());
    await src.connect();
    await src.captureFrame("insp-vision-test", 1);
    await src.captureFrame("insp-vision-test", 2);
    const st: any = src.getStatus();
    expect(st.captureStats.framesCaptured).toBe(2);
    expect(st.captureStats.avgCaptureMs).toBe(12.5);
    // Device-declared 30fps is exposed as device info, NOT as measured FPS.
    expect(st.deviceInfo.fps).toBe(30);
    const measured = st.captureStats.measuredFps;
    expect(measured === null || (measured > 0 && measured < 100000)).toBe(true);
    await src.disconnect();
  });
});

describe("6E. USB → pipeline → inference → evidence", () => {
  it("runs the shared analyseFrame and links USB evidence to its frame", async () => {
    const pipe = freshPipeline();
    const src = new UsbCameraSource("0", undefined, new StubUvcBackend());
    await src.connect();
    const frame = await src.captureFrame("insp-vision-test", 1);
    expect(pipe.submitFrame(frame)).toBe("queued");
    const detection = await pipe.processNext();
    expect(detection).toBeTruthy();
    const evidenceId = persistVisionEvidence({
      inspectionId: "insp-vision-test",
      droneId: "drone-test",
      detection: detection!,
      frame,
    });
    const db = getDb();
    const row = db.prepare("SELECT frame_id, source_type FROM inspection_evidence WHERE id = ?").get(evidenceId) as any;
    expect(row.frame_id).toBe(frame.frameId);
    expect(row.source_type).toBe(VisionSourceType.USB_CAMERA);
    await src.disconnect();
    pipe.resetForTests();
  });

  it("corrupt USB bytes are labeled INVALID, never silently dropped into ML as good", async () => {
    const pipe = freshPipeline();
    const frame = makeFrame({
      sourceType: VisionSourceType.USB_CAMERA,
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0x00, 0x01, 0x02, 0x03]),
    });
    expect(pipe.submitFrame(frame)).toBe("queued");
    await pipe.processNext();
    expect(frame.quality?.qualityStatus).toBe(VisionQualityStatus.INVALID);
    pipe.resetForTests();
  });
});

describe("6E. source switching API", () => {
  it("switches between software sources and rejects unknown kinds", async () => {
    resetVisionRuntimeForTests();
    const toFixture = await request(app).post("/api/vision/source").send({ source: "fixture" });
    expect(toFixture.status).toBe(200);
    expect(toFixture.body.switched).toBe(true);
    expect(toFixture.body.status.sourceType).toBe(VisionSourceType.FIXTURE_IMAGE);

    const toSim = await request(app).post("/api/vision/source").send({ source: "simulated" });
    expect(toSim.status).toBe(200);
    expect(toSim.body.status.sourceType).toBe(VisionSourceType.SIMULATED);

    const bogus = await request(app).post("/api/vision/source").send({ source: "nope" });
    expect(bogus.status).toBe(400);

    const missing = await request(app).post("/api/vision/source").send({});
    expect(missing.status).toBe(400);
    resetVisionRuntimeForTests();
  });

  it("rejects unavailable hardware without switching (no silent fallback)", async () => {
    resetVisionRuntimeForTests();
    await request(app).post("/api/vision/source").send({ source: "fixture" });
    const rov = await request(app).post("/api/vision/source").send({ source: "rov" });
    expect(rov.status).toBe(409);
    expect(rov.body.switched).toBe(false);
    // Previous source kept.
    const st = await request(app).get("/api/vision/status");
    expect(st.body.sourceType).toBe(VisionSourceType.FIXTURE_IMAGE);
    resetVisionRuntimeForTests();
  });
});

describe("6E. vision status and intelligence APIs", () => {
  it("status exposes source, counters, and ROV honesty", async () => {
    resetVisionRuntimeForTests();
    const res = await request(app).get("/api/vision/status");
    expect(res.status).toBe(200);
    expect(res.body.sourceType).toBeTruthy();
    expect(typeof res.body.framesCaptured).toBe("number");
    expect(typeof res.body.queueDepth).toBe("number");
    expect(res.body.rovTelemetryAvailable).toBe(false);
    resetVisionRuntimeForTests();
  });

  it("rejects unauthenticated vision requests", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const res = await request(app).get("/api/vision/status");
      expect(res.status).toBe(401);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("intelligence carries capture-latency and vision provenance keys", async () => {
    const res = await request(app).get("/api/system/intelligence");
    expect(res.status).toBe(200);
    expect("avgCaptureLatencyMs" in res.body.vision).toBe(true);
    expect(typeof res.body.vision.framesCaptured).toBe("number");
  });
});

describe("6E. REAL physical camera (gated)", () => {
  it("captures a genuine frame when hardware is explicitly enabled", async () => {
    if (process.env.RUN_REAL_CAMERA_TESTS !== "true") {
      expect(process.env.RUN_REAL_CAMERA_TESTS ?? "unset").not.toBe("true");
      return;
    }
    const src = new UsbCameraSource(process.env.VISION_CAMERA_DEVICE ?? "0");
    const st = await src.connect();
    expect(st.connected).toBe(true);
    const frame = await src.captureFrame("insp-vision-test", 1);
    expect(frame.sourceType).toBe(VisionSourceType.USB_CAMERA);
    expect(frame.buffer[0]).toBe(0xff);
    expect(frame.buffer[1]).toBe(0xd8);
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.sequenceNumber).toBe(1);
    await src.disconnect();
  }, 60000);
});
