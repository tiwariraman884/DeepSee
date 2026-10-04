/**
 * Vision frame contracts (Phase 6D).
 * ============================================================
 * One normalized frame type for every camera source. Provenance is
 * mandatory — no free-form source strings anywhere in the pipeline.
 */

export const VisionSourceType = {
  SIMULATED: "SIMULATED",
  FIXTURE_IMAGE: "FIXTURE_IMAGE",
  FIXTURE_VIDEO: "FIXTURE_VIDEO",
  USB_CAMERA: "USB_CAMERA",
  RTSP_CAMERA: "RTSP_CAMERA",
  ROV_CAMERA: "ROV_CAMERA",
} as const;
export type VisionSourceType = (typeof VisionSourceType)[keyof typeof VisionSourceType];

export function isVisionSourceType(v: unknown): v is VisionSourceType {
  return typeof v === "string" && (Object.values(VisionSourceType) as string[]).includes(v);
}

/** Sources that may only ever come from a physically connected device. */
export function isHardwareVisionSource(t: VisionSourceType): boolean {
  return t === VisionSourceType.USB_CAMERA || t === VisionSourceType.ROV_CAMERA;
}

/** Sources that must never display as real hardware. */
export function isTestVisionSource(t: VisionSourceType): boolean {
  return (
    t === VisionSourceType.SIMULATED ||
    t === VisionSourceType.FIXTURE_IMAGE ||
    t === VisionSourceType.FIXTURE_VIDEO
  );
}

export const VisionQualityStatus = {
  GOOD: "GOOD",
  LOW_LIGHT: "LOW_LIGHT",
  BLURRY: "BLURRY",
  INVALID: "INVALID",
  LOW_RESOLUTION: "LOW_RESOLUTION",
} as const;
export type VisionQualityStatus = (typeof VisionQualityStatus)[keyof typeof VisionQualityStatus];

export const VisionProcessingStatus = {
  QUEUED: "QUEUED",
  PROCESSED: "PROCESSED",
  DROPPED: "DROPPED",
  FAILED: "FAILED",
} as const;
export type VisionProcessingStatus =
  (typeof VisionProcessingStatus)[keyof typeof VisionProcessingStatus];

export interface VisionFrameQuality {
  width: number | null;
  height: number | null;
  /** Mean luma 0–255 when pixels are decodable, else null (never guessed). */
  brightness: number | null;
  /** Laplacian variance on downsampled grayscale when decodable, else null. */
  sharpness: number | null;
  byteSize: number;
  mimeType: string;
  validFrame: boolean;
  qualityStatus: VisionQualityStatus;
  /** Human note explaining heuristic limits — no calibrated % claims. */
  qualityNote: string;
}

export interface VisionFrame {
  frameId: string;
  inspectionId: string;
  sourceType: VisionSourceType;
  capturedAt: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  /** In-memory bytes (fixtures/generated). Hardware adapters stream here too. */
  buffer: Buffer;
  sequenceNumber: number;
  sourceDeviceId: string | null;
  cameraId: string;
  quality: VisionFrameQuality | null;
  processingStatus: VisionProcessingStatus;
  inferenceMs: number | null;
}

export const VisionErrorCode = {
  CAMERA_DEVICE_NOT_FOUND: "CAMERA_DEVICE_NOT_FOUND",
  CAMERA_PERMISSION_DENIED: "CAMERA_PERMISSION_DENIED",
  CAMERA_STREAM_UNAVAILABLE: "CAMERA_STREAM_UNAVAILABLE",
  CAMERA_NOT_CONFIGURED: "CAMERA_NOT_CONFIGURED",
  FRAME_DECODE_FAILED: "FRAME_DECODE_FAILED",
  FRAME_INVALID: "FRAME_INVALID",
  FRAME_TOO_SMALL: "FRAME_TOO_SMALL",
  FRAME_QUEUE_FULL: "FRAME_QUEUE_FULL",
  VISION_INFERENCE_FAILED: "VISION_INFERENCE_FAILED",
  VISION_SOURCE_TIMEOUT: "VISION_SOURCE_TIMEOUT",
  VISION_STORAGE_FAILED: "VISION_STORAGE_FAILED",
} as const;
export type VisionErrorCode = (typeof VisionErrorCode)[keyof typeof VisionErrorCode];

export class VisionError extends Error {
  readonly code: VisionErrorCode;
  constructor(code: VisionErrorCode, message: string) {
    super(message);
    this.name = "VisionError";
    this.code = code;
  }
}

/** Future ROV telemetry contract — every field nullable (null = NOT PROVIDED). */
export interface RovTelemetry {
  rovId: string | null;
  depthMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  headingDegrees: number | null;
  pitchDegrees: number | null;
  rollDegrees: number | null;
  speedMetersPerSecond: number | null;
  batteryPercent: number | null;
  connectionState: string | null;
}

export function emptyRovTelemetry(): RovTelemetry {
  return {
    rovId: null,
    depthMeters: null,
    latitude: null,
    longitude: null,
    headingDegrees: null,
    pitchDegrees: null,
    rollDegrees: null,
    speedMetersPerSecond: null,
    batteryPercent: null,
    connectionState: null,
  };
}
