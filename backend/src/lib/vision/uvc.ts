/**
 * UVC capture backends (Phase 6E).
 * ============================================================
 * The default backend shells to `backend/scripts/vision-capture.py`
 * (Python + OpenCV/DirectShow) per capture — short-lived processes with a
 * hard timeout kill, so no orphaned camera handles can survive. Each call
 * validates JPEG magic bytes; anything else is a capture failure, never a
 * frame. The interface is injectable so tests exercise all lifecycle logic
 * against a deterministic stub without photon hardware.
 */
import { execFile } from "child_process";
import path from "path";

export interface UvcDeviceInfo {
  index: number;
  name: string;
  width: number | null;
  height: number | null;
  fps: number | null;
}

export interface UvcCaptureResult {
  bytes: Buffer;
  /** Container of the captured bytes (JPEG from OpenCV; stubs may use BMP). */
  mimeType: string;
  width: number;
  height: number;
  captureMs: number;
  deviceName: string;
}

export interface UvcCaptureBackend {
  listDevices(maxIndex?: number): Promise<UvcDeviceInfo[]>;
  captureStill(device: string, width: number, height: number, timeoutMs: number): Promise<UvcCaptureResult>;
}

function scriptPath(): string {
  return path.join(__dirname, "..", "..", "..", "scripts", "vision-capture.py");
}

function runPython(args: string[], timeoutMs: number): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const python = process.env.VISION_PYTHON ?? "python";
    execFile(
      python,
      [scriptPath(), ...args],
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, encoding: "buffer" as any },
      (err: any, stdout: Buffer, stderr: Buffer) => {
        if (err) {
          const timedOut = (err as any)?.killed === true;
          reject(new Error(timedOut ? "CAPTURE_TIMEOUT" : `CAPTURE_SPAWN_FAILED: ${(err as Error).message}`));
          return;
        }
        resolve({ stdout, stderr: Buffer.from(stderr).toString("utf8") });
      }
    );
  });
}

function lastJsonLine(stderr: string): any | null {
  const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed && typeof parsed === "object") return parsed;
    } catch { /* not JSON */ }
  }
  return null;
}

export class PythonOpenCvBackend implements UvcCaptureBackend {
  async listDevices(maxIndex = 3): Promise<UvcDeviceInfo[]> {
    let out: { stdout: Buffer; stderr: string };
    try {
      out = await runPython(["discover", "--max-index", String(maxIndex)], 30000);
    } catch (e: any) {
      if (/CAPTURE_SPAWN_FAILED/.test(e?.message ?? "")) {
        throw new Error("OPENCV_NOT_INSTALLED");
      }
      throw e;
    }
    try {
      const parsed = JSON.parse(out.stdout.toString("utf8"));
      if (!Array.isArray(parsed)) return [];
      return parsed.map((d: any) => ({
        index: Number(d.index),
        name: String(d.name ?? `Camera ${d.index}`),
        width: typeof d.width === "number" ? d.width : null,
        height: typeof d.height === "number" ? d.height : null,
        fps: typeof d.fps === "number" && d.fps > 0 ? d.fps : null,
      }));
    } catch {
      return [];
    }
  }

  async captureStill(device: string, width: number, height: number, timeoutMs: number): Promise<UvcCaptureResult> {
    const out = await runPython(
      ["capture", "--device", device, "--width", String(width), "--height", String(height), "--timeout", String(Math.max(1, timeoutMs / 1000))],
      timeoutMs + 5000
    );
    const summary = lastJsonLine(out.stderr);
    if (!summary?.ok) {
      throw new Error(summary?.error ?? "CAPTURE_FAILED");
    }
    const bytes = out.stdout;
    if (!Buffer.isBuffer(bytes) || bytes.length < 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      throw new Error("FRAME_DECODE_FAILED");
    }
    return {
      bytes,
      mimeType: "image/jpeg",
      width: Number(summary.width) || 0,
      height: Number(summary.height) || 0,
      captureMs: Number(summary.captureMs) || 0,
      deviceName: String(summary.device ?? device),
    };
  }
}
