/**
 * Camera source adapters (Phase 6D).
 * ============================================================
 * Every source normalizes into the same VisionFrame contract. Provenance is
 * assigned ONLY by the adapter that actually produced the bytes:
 *
 *   SIMULATED     — existing sample-frame flow (unchanged behavior)
 *   FIXTURE_IMAGE — deterministic generated BMP stills (test/dev)
 *   FIXTURE_VIDEO — deterministic generated BMP sequences (test/dev)
 *   USB_CAMERA    — physical device adapter (UNAVAILABLE until hardware)
 *   RTSP_CAMERA   — network stream adapter (config-driven, else unavailable)
 *   ROV_CAMERA    — reserved for future ROV integration (not connected)
 *
 * Test/fixture sources must never display as real hardware.
 */
import fs from "fs";
import path from "path";
import { generateFixtureBmp } from "./bmp";
import {
  VisionError,
  VisionErrorCode,
  VisionSourceType,
  type VisionFrame,
} from "./types";
import { PythonOpenCvBackend, type UvcCaptureBackend, type UvcDeviceInfo } from "./uvc";

export interface CameraSourceStatus {
  sourceType: VisionSourceType;
  cameraId: string;
  connected: boolean;
  state: "READY" | "STREAMING" | "RUNNING" | "UNAVAILABLE" | "ERROR" | "DISABLED";
  errorCode?: VisionErrorCode | string;
  errorDetail?: string;
  capabilities: string[];
  /** Device discovery detail (USB only, when a device matched). */
  deviceInfo?: { deviceId: string; deviceName: string; width: number | null; height: number | null; fps: number | null };
  /** Measured capture telemetry (USB only, session-scoped). */
  captureStats?: { framesCaptured: number; avgCaptureMs: number | null; measuredFps: number | null };
}

export interface CameraSource {
  readonly sourceType: VisionSourceType;
  readonly cameraId: string;
  connect(): Promise<CameraSourceStatus>;
  disconnect(): Promise<void>;
  getStatus(): CameraSourceStatus;
  getCapabilities(): string[];
  /** Single-frame capture normalized into the frame contract. */
  captureFrame(inspectionId: string, sequenceNumber: number): Promise<VisionFrame>;
}

let frameCounter = 0;
export function nextFrameId(prefix = "frm"): string {
  frameCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${frameCounter.toString(36)}`;
}

function samplesDir(): string {
  return path.join(process.cwd(), "..", "frontend", "public", "species", "samples");
}

function listSampleFiles(): string[] {
  try {
    return fs
      .readdirSync(samplesDir())
      .filter((f) => /\.(webp|png|jpe?g)$/i.test(f))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Simulated source — the EXISTING sample-frame flow, unchanged semantics:
 * a real sample file is returned as-is (opaque bytes for the analyzer).
 */
export class SimulatedCameraSource implements CameraSource {
  readonly sourceType = VisionSourceType.SIMULATED;
  readonly cameraId = "simulated-camera-01";
  private connected = false;

  async connect(): Promise<CameraSourceStatus> {
    this.connected = true;
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  getStatus(): CameraSourceStatus {
    return {
      sourceType: this.sourceType,
      cameraId: this.cameraId,
      connected: this.connected,
      state: this.connected ? "READY" : "DISABLED",
      capabilities: ["single-capture"],
    };
  }

  getCapabilities(): string[] {
    return ["single-capture"];
  }

  async captureFrame(inspectionId: string, sequenceNumber: number): Promise<VisionFrame> {
    const files = listSampleFiles();
    if (files.length === 0) {
      throw new VisionError(VisionErrorCode.CAMERA_STREAM_UNAVAILABLE, "No simulation sample frames found.");
    }
    // Random pick preserves the exact legacy behavior of pickSampleFrame().
    const file = files[Math.floor(Math.random() * files.length)];
    const buffer = fs.readFileSync(path.join(samplesDir(), file));
    return {
      frameId: nextFrameId("frm-sim"),
      inspectionId,
      sourceType: this.sourceType,
      capturedAt: new Date().toISOString(),
      width: null,
      height: null,
      mimeType: "application/octet-stream",
      buffer,
      sequenceNumber,
      sourceDeviceId: null,
      cameraId: `${this.cameraId}:${file}`,
      quality: null,
      processingStatus: "QUEUED",
      inferenceMs: null,
    };
  }
}

export interface FixtureSourceOptions {
  width?: number;
  height?: number;
  fps?: number;
  frameCount?: number;
}

/**
 * Deterministic fixture source — generated BMP patterns, no binaries in git.
 * Frame N is always byte-identical for the same (width, height, seed): use
 * sequenceNumber as the seed for repeatable inspection runs.
 */
export class FixtureCameraSource implements CameraSource {
  readonly sourceType: VisionSourceType;
  readonly cameraId: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly frameCount: number;
  private connected = false;
  private emitted = 0;

  constructor(kind: "image" | "video" = "image", cameraId = "fixture-camera-01", opts: FixtureSourceOptions = {}) {
    this.sourceType = kind === "video" ? VisionSourceType.FIXTURE_VIDEO : VisionSourceType.FIXTURE_IMAGE;
    this.cameraId = cameraId;
    this.width = Math.max(8, Math.floor(opts.width ?? 160));
    this.height = Math.max(8, Math.floor(opts.height ?? 120));
    this.fps = Math.max(1, Math.min(30, opts.fps ?? 10));
    this.frameCount = Math.max(1, Math.min(600, opts.frameCount ?? (kind === "video" ? 30 : 1)));
  }

  async connect(): Promise<CameraSourceStatus> {
    this.connected = true;
    this.emitted = 0;
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  getStatus(): CameraSourceStatus {
    return {
      sourceType: this.sourceType,
      cameraId: this.cameraId,
      connected: this.connected,
      state: this.connected ? "STREAMING" : "DISABLED",
      capabilities: this.getCapabilities(),
    };
  }

  getCapabilities(): string[] {
    return this.sourceType === VisionSourceType.FIXTURE_VIDEO
      ? ["single-capture", "streaming", "deterministic-sequence"]
      : ["single-capture", "deterministic-frame"];
  }

  /** Deterministic bytes for (width, height, seed) — stable across runs. */
  static fixtureBytes(width: number, height: number, seed: number): Buffer {
    return generateFixtureBmp(width, height, seed);
  }

  async captureFrame(inspectionId: string, sequenceNumber: number): Promise<VisionFrame> {
    if (!this.connected) {
      throw new VisionError(VisionErrorCode.CAMERA_STREAM_UNAVAILABLE, "Fixture source not connected.");
    }
    if (this.sourceType === VisionSourceType.FIXTURE_VIDEO && this.emitted >= this.frameCount) {
      throw new VisionError(VisionErrorCode.CAMERA_STREAM_UNAVAILABLE, "Fixture sequence exhausted.");
    }
    this.emitted += 1;
    return {
      frameId: nextFrameId("frm-fixture"),
      inspectionId,
      sourceType: this.sourceType,
      capturedAt: new Date().toISOString(),
      width: this.width,
      height: this.height,
      mimeType: "image/bmp",
      buffer: generateFixtureBmp(this.width, this.height, sequenceNumber),
      sequenceNumber,
      sourceDeviceId: null,
      cameraId: this.cameraId,
      quality: null,
      processingStatus: "QUEUED",
      inferenceMs: null,
    };
  }
}

/**
 * USB/UVC source backed by a real capture backend (default: Python + OpenCV).
 * Each capture spawns a short-lived, timeout-guarded process — no persistent
 * handles, so disconnect/stop is always clean and server shutdown leaks
 * nothing. Without a device the source reports UNAVAILABLE with a
 * machine-readable code and capture throws: never a silent fixture fallback.
 */
export class UsbCameraSource implements CameraSource {
  readonly sourceType = VisionSourceType.USB_CAMERA;
  readonly cameraId: string;
  private readonly deviceSelector: string;
  private readonly wantWidth: number;
  private readonly wantHeight: number;
  private readonly backend: UvcCaptureBackend;

  private connected = false;
  private deviceInfo: UvcDeviceInfo | null = null;
  private sequence = 0;
  private captureSamples: number[] = [];
  private captureAtLog: number[] = [];
  private framesCaptured = 0;

  constructor(
    deviceSelector = process.env.VISION_CAMERA_DEVICE ?? "0",
    cameraId?: string,
    backend?: UvcCaptureBackend,
    opts: { width?: number; height?: number } = {}
  ) {
    this.deviceSelector = deviceSelector;
    this.cameraId = cameraId ?? `usb-camera-${deviceSelector}`;
    this.backend = backend ?? new PythonOpenCvBackend();
    this.wantWidth = Math.max(0, Number(opts.width ?? process.env.VISION_CAMERA_WIDTH ?? 0) || 0);
    this.wantHeight = Math.max(0, Number(opts.height ?? process.env.VISION_CAMERA_HEIGHT ?? 0) || 0);
  }

  private matchDevice(devices: UvcDeviceInfo[]): UvcDeviceInfo | null {
    const sel = this.deviceSelector.trim().toLowerCase();
    // Empty selector means "not configured" — never match every device.
    if (!sel) return null;
    return (
      devices.find((d) => String(d.index) === sel) ??
      devices.find((d) => d.name.toLowerCase().includes(sel)) ??
      null
    );
  }

  async connect(): Promise<CameraSourceStatus> {
    let devices: UvcDeviceInfo[];
    try {
      devices = await this.backend.listDevices(5);
    } catch (e: any) {
      this.connected = false;
      this.deviceInfo = null;
      return this.status(
        "UNAVAILABLE",
        /OPENCV_NOT_INSTALLED/.test(e?.message ?? "")
          ? VisionErrorCode.CAMERA_STREAM_UNAVAILABLE
          : VisionErrorCode.CAMERA_DEVICE_NOT_FOUND,
        /OPENCV_NOT_INSTALLED/.test(e?.message ?? "")
          ? "OpenCV capture helper unavailable."
          : `Discovery failed: ${e?.message ?? "unknown"}.`
      );
    }
    const found = this.matchDevice(devices);
    if (!found) {
      this.connected = false;
      this.deviceInfo = null;
      return this.status(
        "UNAVAILABLE",
        VisionErrorCode.CAMERA_DEVICE_NOT_FOUND,
        devices.length === 0
          ? "No UVC devices detected on this host."
          : `Device "${this.deviceSelector}" not among ${devices.length} detected device(s).`
      );
    }
    this.connected = true;
    this.deviceInfo = found;
    this.sequence = 0;
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    // No persistent handles exist (per-capture processes only).
    this.connected = false;
  }

  getStatus(): CameraSourceStatus {
    if (!this.connected || !this.deviceInfo) {
      return this.status("UNAVAILABLE", VisionErrorCode.CAMERA_DEVICE_NOT_FOUND, "Not connected to a USB camera.");
    }
    const st = this.status("RUNNING");
    st.deviceInfo = {
      deviceId: String(this.deviceInfo.index),
      deviceName: this.deviceInfo.name,
      width: this.deviceInfo.width,
      height: this.deviceInfo.height,
      fps: this.deviceInfo.fps,
    };
    st.captureStats = {
      framesCaptured: this.framesCaptured,
      avgCaptureMs: this.avgCaptureMs(),
      measuredFps: this.measuredFps(),
    };
    return st;
  }

  getCapabilities(): string[] {
    return ["single-capture", "streaming", "measured-fps"];
  }

  async captureFrame(inspectionId: string, _sequenceNumber: number): Promise<VisionFrame> {
    if (!this.connected || !this.deviceInfo) {
      throw new VisionError(
        VisionErrorCode.CAMERA_STREAM_UNAVAILABLE,
        "USB camera is not connected. Connect explicitly — no silent fallback."
      );
    }
    let cap;
    try {
      cap = await this.backend.captureStill(
        String(this.deviceInfo.index),
        this.wantWidth,
        this.wantHeight,
        15000
      );
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (/TIMEOUT/.test(msg)) {
        throw new VisionError(VisionErrorCode.VISION_SOURCE_TIMEOUT, "Capture timed out and was killed.");
      }
      throw new VisionError(VisionErrorCode.CAMERA_STREAM_UNAVAILABLE, `Capture failed: ${msg}`);
    }
    this.sequence += 1;
    this.framesCaptured += 1;
    this.captureSamples.push(cap.captureMs);
    if (this.captureSamples.length > 50) this.captureSamples.splice(0, this.captureSamples.length - 50);
    const now = Date.now();
    this.captureAtLog.push(now);
    if (this.captureAtLog.length > 50) this.captureAtLog.splice(0, this.captureAtLog.length - 50);

    return {
      frameId: nextFrameId("frm-usb"),
      inspectionId,
      sourceType: this.sourceType,
      capturedAt: new Date().toISOString(),
      width: cap.width || null,
      height: cap.height || null,
      mimeType: cap.mimeType,
      buffer: cap.bytes,
      sequenceNumber: this.sequence,
      sourceDeviceId: String(this.deviceInfo.index),
      cameraId: this.cameraId,
      quality: null,
      processingStatus: "QUEUED",
      inferenceMs: null,
    };
  }

  private status(
    state: CameraSourceStatus["state"],
    errorCode?: VisionErrorCode | string,
    errorDetail?: string
  ): CameraSourceStatus {
    return {
      sourceType: this.sourceType,
      cameraId: this.cameraId,
      connected: this.connected,
      state,
      ...(errorCode ? { errorCode } : {}),
      ...(errorDetail ? { errorDetail } : {}),
      capabilities: this.getCapabilities(),
    };
  }

  private avgCaptureMs(): number | null {
    if (this.captureSamples.length === 0) return null;
    return Math.round((this.captureSamples.reduce((a, b) => a + b, 0) / this.captureSamples.length) * 10) / 10;
  }

  private measuredFps(): number | null {
    const now = Date.now();
    const recent = this.captureAtLog.filter((t) => now - t <= 10_000);
    if (recent.length < 2) return null;
    const span = (recent[recent.length - 1] - recent[0]) / 1000;
    if (span <= 0) return null;
    return Math.round(((recent.length - 1) / span) * 10) / 10;
  }
}

/**
 * RTSP/MJPEG adapter architecture (config-driven). Validates configuration
 * without hanging on unreachable networks: capture attempts fail fast with
 * machine-readable codes. Full streaming is out of Phase 6D scope.
 */
export class RtspCameraSource implements CameraSource {
  readonly sourceType = VisionSourceType.RTSP_CAMERA;
  readonly cameraId: string;
  private readonly streamUrl: string;

  constructor(streamUrl = process.env.VISION_RTSP_URL ?? "", cameraId = "rtsp-camera-01") {
    this.streamUrl = streamUrl;
    this.cameraId = cameraId;
  }

  /** Config validation: scheme + host present, no credentials logged. */
  validateConfig(): { ok: boolean; code?: VisionErrorCode; detail?: string } {
    if (!this.streamUrl) {
      return { ok: false, code: VisionErrorCode.CAMERA_NOT_CONFIGURED, detail: "VISION_RTSP_URL is not set." };
    }
    let u: URL;
    try {
      u = new URL(this.streamUrl);
    } catch {
      return { ok: false, code: VisionErrorCode.CAMERA_NOT_CONFIGURED, detail: "VISION_RTSP_URL is not a valid URL." };
    }
    if (!["rtsp:", "http:", "https:"].includes(u.protocol) || !u.hostname) {
      return { ok: false, code: VisionErrorCode.CAMERA_NOT_CONFIGURED, detail: "URL must be rtsp:// or http(s):// with a host." };
    }
    return { ok: true };
  }

  /** Redacted URL safe for logs/UI (never the password). */
  redactedUrl(): string {
    try {
      const u = new URL(this.streamUrl);
      u.password = "***";
      return u.toString();
    } catch {
      return "(unconfigured)";
    }
  }

  async connect(): Promise<CameraSourceStatus> {
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    /* nothing held */
  }

  getStatus(): CameraSourceStatus {
    const v = this.validateConfig();
    if (!v.ok) {
      return {
        sourceType: this.sourceType,
        cameraId: this.cameraId,
        connected: false,
        state: "UNAVAILABLE",
        errorCode: v.code,
        errorDetail: v.detail,
        capabilities: ["streaming"],
      };
    }
    return {
      sourceType: this.sourceType,
      cameraId: this.cameraId,
      connected: false,
      state: "UNAVAILABLE",
      errorCode: VisionErrorCode.CAMERA_STREAM_UNAVAILABLE,
      errorDetail: "Network streaming out of Phase 6D scope; adapter ready.",
      capabilities: ["streaming"],
    };
  }

  getCapabilities(): string[] {
    return ["streaming"];
  }

  async captureFrame(_inspectionId: string, _sequenceNumber: number): Promise<VisionFrame> {
    const st = this.getStatus();
    throw new VisionError(
      (st.errorCode as VisionErrorCode) ?? VisionErrorCode.CAMERA_STREAM_UNAVAILABLE,
      st.errorDetail ?? "RTSP source unavailable."
    );
  }
}

/** ROV camera placeholder: reserved, never connected in Phase 6D. */
export class RovCameraSource implements CameraSource {
  readonly sourceType = VisionSourceType.ROV_CAMERA;
  readonly cameraId = "rov-camera-01";

  async connect(): Promise<CameraSourceStatus> {
    return this.getStatus();
  }
  async disconnect(): Promise<void> {
    /* nothing held */
  }
  getStatus(): CameraSourceStatus {
    return {
      sourceType: this.sourceType,
      cameraId: this.cameraId,
      connected: false,
      state: "UNAVAILABLE",
      errorCode: VisionErrorCode.CAMERA_DEVICE_NOT_FOUND,
      errorDetail: "No ROV hardware present.",
      capabilities: ["single-capture", "streaming", "telemetry-join"],
    };
  }
  getCapabilities(): string[] {
    return ["single-capture", "streaming", "telemetry-join"];
  }
  async captureFrame(_inspectionId: string, _sequenceNumber: number): Promise<VisionFrame> {
    throw new VisionError(VisionErrorCode.CAMERA_DEVICE_NOT_FOUND, "No ROV hardware present.");
  }
}

/** Build the configured source. No secrets leave the backend. */
export function createVisionSourceFromEnv(): CameraSource {
  const kind = (process.env.VISION_SOURCE ?? "fixture").toLowerCase();
  if (kind === "usb") return new UsbCameraSource();
  if (kind === "rtsp") return new RtspCameraSource();
  if (kind === "rov") return new RovCameraSource();
  if (kind === "simulated") return new SimulatedCameraSource();
  if (kind === "fixture-video") return new FixtureCameraSource("video");
  return new FixtureCameraSource("image");
}
