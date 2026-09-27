/**
 * DeepSea ML Worker (Pre-loaded Model Manager)
 * ==============================================
 * Ye Node.js module ek long-running Python process maintain karta hai
 * jo anomaly model ko RAM mein loaded rakhta hai.
 *
 * PROBLEM PEHLE:
 *   Har /api/sensors/predict request par:
 *   → python spawn karo (100-500ms overhead)
 *   → model load karo (300ms+)
 *   → predict karo
 *   Total: ~500-800ms per request ❌
 *
 * SOLUTION ABHI:
 *   Server start pe: python spawn karo + model RAM mein load karo
 *   Har request par: stdin mein JSON bhejo, stdout se result lo
 *   Total: ~1-5ms per request ✅ (100x faster!)
 *
 * Protocol: NDJSON (Newline-Delimited JSON) over stdin/stdout
 */

import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import { EventEmitter } from "events";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MLPredictionInput {
  temperature: number;
  ph: number;
  salinity: number;
  oxygen: number;
  turbidity: number;
}

export interface MLPredictionResult {
  isAnomaly: boolean;
  score: number;
  status: "success" | "error";
  latency_ms: number;
  message?: string;
}

// ─── ML Worker Class ──────────────────────────────────────────────────────────
class MLWorker extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private ready = false;
  private pendingRequests = new Map<string, {
    resolve: (val: MLPredictionResult) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private buffer = "";
  private reqCounter = 0;
  private readonly mlDir: string;
  private readonly scriptPath: string;
  private restartAttempts = 0;
  private readonly MAX_RESTARTS = 5;

  constructor() {
    super();
    this.mlDir = path.join(process.cwd(), "..", "ml");
    this.scriptPath = path.join(this.mlDir, "predict_server.py");
  }

  /** Start the Python ML server process */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("[MLWorker] Spawning Python inference server...");

      this.process = spawn("python", [this.scriptPath], {
        cwd: this.mlDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // ── stdout handler ─────────────────────────────────────────────────────
      this.process.stdout.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString();
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() ?? "";   // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);

            if (msg.type === "ready") {
              this.ready = true;
              this.restartAttempts = 0;
              console.log(`[MLWorker] ✅ Python ML Server READY — model loaded in RAM (${msg.model})`);
              resolve();
              return;
            }

            if (msg.type === "prediction" || msg.type === "error") {
              const pending = this.pendingRequests.get(msg.id);
              if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(msg.id);
                if (msg.type === "error") {
                  pending.resolve({ isAnomaly: false, score: 0, status: "error", latency_ms: 0, message: msg.message });
                } else {
                  pending.resolve({
                    isAnomaly: msg.isAnomaly,
                    score: msg.score,
                    status: "success",
                    latency_ms: msg.latency_ms,
                  });
                }
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      });

      // ── stderr handler (Python logs) ───────────────────────────────────────
      this.process.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) console.log(`[Python] ${text}`);
      });

      // ── Process exit / crash handler ───────────────────────────────────────
      this.process.on("exit", (code, signal) => {
        this.ready = false;
        console.warn(`[MLWorker] Python process exited (code=${code}, signal=${signal})`);

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("ML worker crashed"));
          this.pendingRequests.delete(id);
        }

        // Auto-restart (like a Kubernetes pod restart policy)
        if (this.restartAttempts < this.MAX_RESTARTS) {
          this.restartAttempts++;
          const delay = Math.min(1000 * this.restartAttempts, 10000);
          console.log(`[MLWorker] Restarting in ${delay}ms (attempt ${this.restartAttempts}/${this.MAX_RESTARTS})...`);
          setTimeout(() => this.start().catch(console.error), delay);
        } else {
          console.error("[MLWorker] Max restarts reached. Giving up.");
        }
      });

      this.process.on("error", (err) => {
        console.error("[MLWorker] Process error:", err.message);
        reject(err);
      });

      // Timeout if model doesn't load in 30s
      setTimeout(() => {
        if (!this.ready) {
          reject(new Error("[MLWorker] Timeout: Python server did not become ready in 30s"));
        }
      }, 30000);
    });
  }

  /** Predict (async, sub-5ms once model is in RAM) */
  predict(input: MLPredictionInput, timeoutMs = 5000): Promise<MLPredictionResult> {
    if (!this.ready || !this.process) {
      return Promise.resolve({ isAnomaly: false, score: 0, status: "error", latency_ms: 0, message: "ML worker not ready" });
    }

    return new Promise((resolve, reject) => {
      const id = `req-${++this.reqCounter}`;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        resolve({ isAnomaly: false, score: 0, status: "error", latency_ms: 0, message: "ML prediction timeout" });
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const payload = JSON.stringify({ id, ...input }) + "\n";
      this.process!.stdin.write(payload);
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
      this.ready = false;
    }
  }
}

// ─── Singleton export ──────────────────────────────────────────────────────────
export const mlWorker = new MLWorker();
export default mlWorker;
