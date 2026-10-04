/**
 * Managed vision source runtime (Phase 6D).
 * ============================================================
 * One lazily connected source instance shared by the inspection flow and
 * the status API. Default (VISION_SOURCE unset) is the SIMULATED source,
 * preserving the exact legacy inspection behavior. Test/fixture/hardware
 * sources are selected purely through environment configuration.
 */
import { createVisionSourceFromEnv, type CameraSource } from "./sources";
import { VisionError, VisionErrorCode } from "./types";
import { visionPipeline } from "./pipeline";

let managed: CameraSource | null = null;
let overrideKind: string | null = null;

function buildSource(kind: string | null): CameraSource {
  const k = (kind ?? process.env.VISION_SOURCE ?? "simulated").toLowerCase();
  // Reuse the env factory by temporarily overriding VISION_SOURCE.
  const prev = process.env.VISION_SOURCE;
  try {
    process.env.VISION_SOURCE = k;
    return createVisionSourceFromEnv();
  } finally {
    if (prev === undefined) delete process.env.VISION_SOURCE;
    else process.env.VISION_SOURCE = prev;
  }
}

export async function ensureVisionSource(): Promise<CameraSource> {
  if (!managed) {
    managed = buildSource(overrideKind);
    try {
      await managed.connect();
    } catch {
      // Adapters report availability via getStatus(); a connect throw must
      // never break the inspection flow — callers degrade gracefully.
    }
    visionPipeline.configureSource(managed);
  }
  return managed;
}

/**
 * Explicit source switching (API-driven). Hardware targets that are
 * unavailable REJECT the switch (409 upstream) — the previous source stays
 * active. Silent fallback to fixture/simulation is forbidden.
 */
export async function switchVisionSource(kind: string) {
  const k = kind.toLowerCase();
  const allowlist = ["simulated", "fixture", "fixture-image", "fixture-video", "usb", "rtsp", "rov"];
  if (!allowlist.includes(k)) {
    throw new VisionError(VisionErrorCode.CAMERA_NOT_CONFIGURED, `Unknown vision source "${kind}".`);
  }
  const candidate = buildSource(k === "fixture" ? "fixture" : k);
  let status;
  try {
    status = await candidate.connect();
  } catch (e: any) {
    throw new VisionError(
      VisionErrorCode.CAMERA_STREAM_UNAVAILABLE,
      `Source "${k}" failed to connect: ${e?.message ?? "unknown"}.`
    );
  }
  if (!status.connected) {
    throw new VisionError(
      (status.errorCode as VisionErrorCode) ?? VisionErrorCode.CAMERA_STREAM_UNAVAILABLE,
      status.errorDetail ?? `Source "${k}" unavailable — switch rejected, previous source kept.`
    );
  }
  try {
    await managed?.disconnect();
  } catch { /* best-effort */ }
  managed = candidate;
  overrideKind = k;
  visionPipeline.configureSource(managed);
  return status;
}

/** Current managed source without side effects (null until ensured). */
export function peekManagedSource(): CameraSource | null {
  return managed;
}

/** Test-only: drop the managed source (disconnect best-effort). */
export function resetVisionRuntimeForTests(): void {
  try {
    managed?.disconnect();
  } catch { /* ignore */ }
  managed = null;
  visionPipeline.configureSource(null);
}
