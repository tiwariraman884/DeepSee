/**
 * DeepSee vision camera smoke test (Phase 6E).
 * ============================================================
 * Usage: npm run vision:camera:test [-- --frames 20 --infer|--no-infer --device 0]
 *
 *   1. discover configured camera
 *   2. connect
 *   3. capture N frames through the REAL bounded VisionPipeline
 *   4. measure FPS + capture latency (never configured values)
 *   5. optionally run resident MobileNet inference per processed frame
 *   6. report drops/queue, cleanup test artifacts, exit cleanly
 *
 * Exit codes: 0 PASS · 2 NO_CAMERA (or inference skipped path still 0 with
 * note) · 1 FAILURE. Missing hardware exits 2 with a clear error — never a
 * silent fixture fallback.
 */
import { UsbCameraSource } from "../src/lib/vision/sources";
import { VisionPipeline } from "../src/lib/vision/pipeline";
import { LocalVisionFrameStorage } from "../src/lib/vision/storage";
import { analyseFrame } from "../src/lib/inspectionAI";
import { speciesWorker } from "../src/lib/speciesWorker";
import { getDb } from "../src/db";
import fs from "fs";
import os from "os";
import path from "path";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main(): Promise<number> {
  const frames = Math.max(1, Math.min(200, Number(arg("--frames", "20")) || 20));
  const wantInfer = !process.argv.includes("--no-infer");
  const device = arg("--device", process.env.VISION_CAMERA_DEVICE ?? "0");

  console.log("DeepSee Vision Camera Test");
  console.log("");

  const source = new UsbCameraSource(device);
  const status = await source.connect();
  console.log(`Source: ${status.sourceType}`);
  if (!status.connected) {
    console.log(`Connected: NO (${status.errorCode ?? "unknown"} — ${status.errorDetail ?? ""})`);
    console.log("Status: NO_CAMERA");
    return 2;
  }
  const dev: any = (status as any).deviceInfo ?? {};
  console.log(`Device: ${dev.deviceId ?? device} (${dev.deviceName ?? "?"})`);
  console.log(`Resolution: ${dev.width ?? "?"}x${dev.height ?? "?"}`);
  console.log("Connected: YES");
  console.log("");

  let inferReady = false;
  if (wantInfer) {
    try {
      if (!speciesWorker.isReady) await speciesWorker.start();
      inferReady = speciesWorker.isReady;
    } catch { /* fall through */ }
  }
  console.log(`Inference backend: ${inferReady ? "resident MobileNet (analyseFrame)" : "SKIPPED (worker unavailable)"}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deepsea-camtest-"));
  const pipe = new VisionPipeline({
    infer: inferReady ? analyseFrame : (async () => null),
    storage: new LocalVisionFrameStorage(tmpDir, 50),
    maxQueue: 3,
    analysisIntervalMs: 500,
  });

  const t0 = Date.now();
  let captured = 0;
  const inspectId = `camera-smoke-${Date.now().toString(36)}`;
  for (let i = 0; i < frames; i++) {
    try {
      const frame = await source.captureFrame(inspectId, i + 1);
      captured += 1;
      pipe.submitFrame(frame);
    } catch (e: any) {
      console.log(`capture ${i + 1} failed: ${e?.message ?? e}`);
      break;
    }
  }
  await pipe.drain();
  const elapsedS = (Date.now() - t0) / 1000;
  const c = pipe.getCounters();
  const st: any = source.getStatus();
  const measuredFps = elapsedS > 0 ? Math.round((captured / elapsedS) * 100) / 100 : 0;

  console.log("");
  console.log(`Frames captured: ${captured}`);
  console.log(`Elapsed: ${elapsedS.toFixed(2)} s`);
  console.log(`Measured FPS: ${measuredFps}`);
  console.log(`Frames processed: ${c.framesProcessed}`);
  console.log(`Dropped frames: ${c.framesDropped}`);
  console.log(`Queue depth: ${c.queueDepth}`);
  console.log(`Average capture: ${st.captureStats?.avgCaptureMs ?? "n/a"} ms`);
  console.log(`Average inference: ${c.avgInferenceMs ?? "n/a"} ms`);
  console.log(`Last quality: ${c.lastQualityStatus ?? "n/a"}`);

  // Cleanup: test artifacts must not pollute the shared DB or disk.
  try {
    const db = getDb();
    db.prepare("DELETE FROM vision_frames WHERE inspection_id = ?").run(inspectId);
    db.prepare("DELETE FROM inspection_evidence WHERE inspection_id = ?").run(inspectId);
  } catch { /* best-effort */ }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* best-effort */ }
  try {
    await source.disconnect();
  } catch { /* best-effort */ }
  try {
    speciesWorker.stop();
  } catch { /* best-effort */ }

  const pass = captured > 0;
  console.log("");
  console.log(`Status: ${pass ? "PASS" : "FAIL"}`);
  return pass ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("Camera test failed:", e?.message ?? e);
    process.exit(1);
  });
