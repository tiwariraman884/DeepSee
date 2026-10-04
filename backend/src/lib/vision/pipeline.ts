/**
 * Vision pipeline (Phase 6D) — one path for every camera source.
 * ============================================================
 *   submit (sampling gate + bounded queue, latest-frame friendly)
 *     → quality analysis → preprocessing → resident MobileNet inference
 *     → frame persistence → evidence persistence → EventBus + SSE
 *
 * Bounds: maxQueue frames pending (default 3), analysis interval gate
 * (default 500 ms), inference timing ring (100). stop() is idempotent.
 * No Math.random() anywhere in accounting — counters only move on real events.
 */
import { eventBus, TOPICS } from "../eventBus";
import { sseManager } from "../sseManager";
import { getDb } from "../../db";
import { analyseFrame, type AiDetection } from "../inspectionAI";
import { analyzeFrameQuality } from "./quality";
import { preprocessFrame, DEFAULT_PREPROCESS_OPTIONS } from "./preprocess";
import { LocalVisionFrameStorage, type VisionFrameStorage } from "./storage";
import type { CameraSource } from "./sources";
import {
  VisionError,
  VisionErrorCode,
  type VisionFrame,
  type VisionProcessingStatus,
} from "./types";

export type VisionInferenceFn = (
  imageB64: string,
  frameFile?: string
) => Promise<AiDetection | null>;

export interface QueuedVisionFrame {
  frame: VisionFrame;
  enqueuedAt: number;
}

export interface VisionPipelineOptions {
  infer?: VisionInferenceFn;
  storage?: VisionFrameStorage;
  maxQueue?: number;
  analysisIntervalMs?: number;
}

export interface VisionCounters {
  framesCaptured: number;
  framesProcessed: number;
  framesDropped: number;
  queueDepth: number;
  avgInferenceMs: number | null;
  lastFrameAt: string | null;
  lastFrameId: string | null;
  lastQualityStatus: string | null;
  measuredFps: number | null;
}

const MAX_INFERENCE_SAMPLES = 100;
const ACCEPTED_AT_WINDOW = 50;

export class VisionPipeline {
  private readonly infer: VisionInferenceFn;
  private readonly storage: VisionFrameStorage;
  private readonly maxQueue: number;
  private readonly analysisIntervalMs: number;

  private activeSource: CameraSource | null = null;
  private queue: QueuedVisionFrame[] = [];
  private lastAcceptedAt = 0;
  private acceptedAtLog: number[] = [];

  private framesCaptured = 0;
  private framesProcessed = 0;
  private framesDropped = 0;
  private inferenceSamples: number[] = [];
  private lastFrameAt: string | null = null;
  private lastFrameId: string | null = null;
  private lastQualityStatus: string | null = null;
  private stopped = false;

  constructor(opts: VisionPipelineOptions = {}) {
    this.infer = opts.infer ?? analyseFrame;
    this.storage = opts.storage ?? new LocalVisionFrameStorage();
    this.maxQueue = Math.max(1, Math.min(100, opts.maxQueue ?? 3));
    this.analysisIntervalMs = Math.max(0, opts.analysisIntervalMs ?? 500);
  }

  /** Active camera source (null until configured). */
  getActiveSource(): CameraSource | null {
    return this.activeSource;
  }

  configureSource(source: CameraSource | null): void {
    this.activeSource = source;
    sseManager.broadcast(source ? "vision_source_connected" : "vision_source_disconnected", {
      sourceType: source?.sourceType ?? null,
      cameraId: source?.cameraId ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  getCounters(): VisionCounters {
    const avg =
      this.inferenceSamples.length === 0
        ? null
        : Math.round(
            (this.inferenceSamples.reduce((a, b) => a + b, 0) / this.inferenceSamples.length) * 10
          ) / 10;
    return {
      framesCaptured: this.framesCaptured,
      framesProcessed: this.framesProcessed,
      framesDropped: this.framesDropped,
      queueDepth: this.queue.length,
      avgInferenceMs: avg,
      lastFrameAt: this.lastFrameAt,
      lastFrameId: this.lastFrameId,
      lastQualityStatus: this.lastQualityStatus,
      measuredFps: this.measuredFps(),
    };
  }

  /** Measured capture rate from accepted-timestamp spacing (null when idle). */
  private measuredFps(): number | null {
    const now = Date.now();
    const recent = this.acceptedAtLog.filter((t) => now - t <= 10_000);
    if (recent.length < 2) return null;
    const spanSec = (recent[recent.length - 1] - recent[0]) / 1000;
    if (spanSec <= 0) return null;
    return Math.round(((recent.length - 1) / spanSec) * 10) / 10;
  }

  /**
   * Submit a frame: sampling gate first (too soon → dropped), then the
   * bounded queue (full → dropped). Either way the counters move honestly.
   */
  submitFrame(frame: VisionFrame): "queued" | "dropped-sampled" | "dropped-queue-full" {
    const now = Date.now();
    if (now - this.lastAcceptedAt < this.analysisIntervalMs) {
      this.framesDropped += 1;
      this.persistFrameRow(frame, "DROPPED");
      return "dropped-sampled";
    }
    if (this.queue.length >= this.maxQueue) {
      this.framesDropped += 1;
      this.persistFrameRow(frame, "DROPPED");
      sseManager.broadcast("vision_frame_dropped", {
        frameId: frame.frameId,
        inspectionId: frame.inspectionId,
        reason: VisionErrorCode.FRAME_QUEUE_FULL,
        timestamp: new Date().toISOString(),
      });
      return "dropped-queue-full";
    }
    this.lastAcceptedAt = now;
    this.acceptedAtLog.push(now);
    if (this.acceptedAtLog.length > ACCEPTED_AT_WINDOW) {
      this.acceptedAtLog.splice(0, this.acceptedAtLog.length - ACCEPTED_AT_WINDOW);
    }
    this.framesCaptured += 1;
    frame.processingStatus = "QUEUED";
    this.queue.push({ frame, enqueuedAt: now });
    eventBus.publish(TOPICS.VISION_FRAME_CAPTURED, {
      frameId: frame.frameId,
      inspectionId: frame.inspectionId,
      sourceType: frame.sourceType,
      timestamp: new Date().toISOString(),
    });
    sseManager.broadcast("vision_frame_captured", {
      frameId: frame.frameId,
      inspectionId: frame.inspectionId,
      sourceType: frame.sourceType,
      timestamp: new Date().toISOString(),
    });
    return "queued";
  }

  /**
   * Process one queued frame end-to-end. Returns the detection (or null when
   * the shared inference path yields none) — callers must degrade gracefully.
   */
  async processNext(): Promise<AiDetection | null> {
    const item = this.queue.shift();
    if (!item) return null;
    const frame = item.frame;

    // 1. Quality (measured where decodable, else container-level honesty).
    const quality = analyzeFrameQuality(frame.buffer, frame.mimeType);
    frame.quality = quality;
    frame.width = quality.width ?? frame.width;
    frame.height = quality.height ?? frame.height;
    this.lastQualityStatus = quality.qualityStatus;

    // 2. Preprocess (throws VisionError on corrupt/undersized input).
    let pre;
    try {
      pre = preprocessFrame(frame.buffer, quality.mimeType, DEFAULT_PREPROCESS_OPTIONS);
    } catch (e: any) {
      frame.processingStatus = "FAILED";
      this.persistFrameRow(frame, "FAILED");
      eventBus.publish(TOPICS.VISION_FRAME_PROCESSED, {
        frameId: frame.frameId,
        inspectionId: frame.inspectionId,
        status: "FAILED",
        reason: e instanceof VisionError ? e.code : VisionErrorCode.FRAME_INVALID,
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    // 3. Resident inference — the SAME analyseFrame every other path uses.
    const t0 = Date.now();
    let detection: AiDetection | null = null;
    try {
      detection = await this.infer(pre.imageB64, frame.cameraId);
    } catch {
      detection = null;
    }
    const inferenceMs = Date.now() - t0;
    frame.inferenceMs = inferenceMs;
    this.inferenceSamples.push(inferenceMs);
    if (this.inferenceSamples.length > MAX_INFERENCE_SAMPLES) {
      this.inferenceSamples.splice(0, this.inferenceSamples.length - MAX_INFERENCE_SAMPLES);
    }

    // 4. Persist frame + store bytes for processed frames.
    frame.processingStatus = "PROCESSED";
    this.framesProcessed += 1;
    this.lastFrameAt = new Date().toISOString();
    this.lastFrameId = frame.frameId;
    this.persistFrameRow(frame, "PROCESSED");
    try {
      this.storage.saveFrame(frame.frameId, frame.inspectionId, frame.buffer, quality.mimeType);
    } catch {
      // Storage failure must not lose the detection; the DB row persists.
    }

    eventBus.publish(TOPICS.VISION_FRAME_PROCESSED, {
      frameId: frame.frameId,
      inspectionId: frame.inspectionId,
      status: "PROCESSED",
      timestamp: new Date().toISOString(),
    });
    eventBus.publish(TOPICS.VISION_INFERENCE_COMPLETED, {
      frameId: frame.frameId,
      inspectionId: frame.inspectionId,
      sourceType: frame.sourceType,
      detected: detection !== null,
      inferenceMs,
      timestamp: new Date().toISOString(),
    });
    sseManager.broadcast("vision_frame_processed", {
      frameId: frame.frameId,
      inspectionId: frame.inspectionId,
      sourceType: frame.sourceType,
      qualityStatus: quality.qualityStatus,
      timestamp: new Date().toISOString(),
    });
    sseManager.broadcast("vision_inference_completed", {
      frameId: frame.frameId,
      inspectionId: frame.inspectionId,
      sourceType: frame.sourceType,
      detected: detection !== null,
      inferenceMs,
      timestamp: new Date().toISOString(),
    });
    return detection;
  }

  /** Drain the queue (used by inspection completion paths). */
  async drain(): Promise<void> {
    while (this.queue.length > 0) {
      await this.processNext();
    }
  }

  /** Idempotent shutdown: safe to call twice. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.queue = [];
    try {
      await this.activeSource?.disconnect();
    } catch { /* best-effort */ }
    this.activeSource = null;
  }

  /** Test-only: clear queue, timers state, and session counters. */
  resetForTests(): void {
    this.queue = [];
    this.lastAcceptedAt = 0;
    this.acceptedAtLog = [];
    this.framesCaptured = 0;
    this.framesProcessed = 0;
    this.framesDropped = 0;
    this.inferenceSamples = [];
    this.lastFrameAt = null;
    this.lastFrameId = null;
    this.lastQualityStatus = null;
    this.stopped = false;
  }

  /**
   * A new inspection mission starts its own sampling window. The
   * single-mission guard guarantees missions never overlap, so sampling
   * state from a previous mission must not gate this mission's frames.
   */
  beginMissionWindow(): void {
    this.lastAcceptedAt = 0;
  }

  private persistFrameRow(frame: VisionFrame, status: VisionProcessingStatus): void {
    try {
      const db = getDb();
      db.prepare(
        `INSERT OR REPLACE INTO vision_frames
           (id, inspection_id, source_type, source_device_id, camera_id,
            sequence_number, captured_at, width, height, mime_type,
            quality_status, brightness, sharpness, processing_status,
            inference_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        frame.frameId,
        frame.inspectionId,
        frame.sourceType,
        frame.sourceDeviceId,
        frame.cameraId,
        frame.sequenceNumber,
        frame.capturedAt,
        frame.width,
        frame.height,
        frame.mimeType,
        frame.quality?.qualityStatus ?? null,
        frame.quality?.brightness ?? null,
        frame.quality?.sharpness ?? null,
        status,
        frame.inferenceMs,
        new Date().toISOString()
      );
    } catch { /* telemetry persistence is best-effort */ }
  }
}

/** Shared pipeline singleton used by the inspection simulator. */
export const visionPipeline = new VisionPipeline();

export interface VisionEvidenceInput {
  inspectionId: string;
  droneId: string;
  detection: AiDetection;
  frame: VisionFrame;
}

/**
 * Persist AI-detection evidence linked to its frame (shared by the
 * inspection simulator and covered directly by tests). Keeps the exact
 * legacy evidence columns/SSE shapes, adding only frame provenance.
 * Returns the evidence id, or null when persistence failed.
 */
export function persistVisionEvidence(input: VisionEvidenceInput): string | null {
  const { inspectionId, droneId, detection, frame } = input;
  const capturedAt = new Date().toISOString();
  const evidenceId = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    getDb().prepare(
      `INSERT INTO inspection_evidence (id, inspection_id, kind, label, confidence, detail, captured_at, frame_id, source_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      evidenceId, inspectionId, detection.kind, detection.label,
      detection.confidence, detection.detail, capturedAt,
      frame.frameId, frame.sourceType
    );
  } catch {
    return null;
  }
  sseManager.broadcast("ai_detection", {
    inspectionId, droneId, ...detection, capturedAt,
    frameId: frame.frameId, sourceType: frame.sourceType,
  });
  sseManager.broadcast("evidence_captured", {
    inspectionId, droneId, kind: detection.kind, label: detection.label,
    confidence: detection.confidence / 100, detail: detection.detail,
    simulation: true, capturedAt,
    frameId: frame.frameId, sourceType: frame.sourceType,
  });
  eventBus.publish(TOPICS.VISION_EVIDENCE_CREATED, {
    evidenceId,
    inspectionId,
    frameId: frame.frameId,
    sourceType: frame.sourceType,
    timestamp: capturedAt,
  });
  sseManager.broadcast("vision_evidence_created", {
    evidenceId,
    inspectionId,
    frameId: frame.frameId,
    sourceType: frame.sourceType,
    timestamp: capturedAt,
  });
  return evidenceId;
}
