import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import { getPythonBin, getMlDir } from "./python";

/**
 * Species classifier worker.
 *
 * Keeps ml/classify_species_server.py resident so the PyTorch checkpoint is
 * loaded once instead of on every request. Spawning per request cost ~44s with
 * the transfer-learning model (torch import + 6MB checkpoint), which exceeded
 * the frontend dev proxy timeout and surfaced as "socket hang up".
 *
 * Falls back to one-shot execFile if the persistent worker cannot start, so a
 * broken worker degrades to slow-but-working rather than failing outright.
 */

type Pending = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
};

class SpeciesClassifierWorker {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private queue: Pending[] = [];
  private ready: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((e: Error) => void) | null = null;
  private failed = false;

  private readonly mlDir = getMlDir();
  private readonly scriptPath = path.join(this.mlDir, "classify_species_server.py");

  /** Start the worker and wait until the model reports ready. */
  start(): Promise<void> {
    if (this.ready) return this.ready;
    if (this.failed) return Promise.reject(new Error("worker previously failed"));

    this.ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    console.log("[SpeciesWorker] Spawning Python classification server...");
    this.proc = spawn(getPythonBin(), [this.scriptPath], {
      cwd: this.mlDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.proc.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
    this.proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) console.log("[SpeciesWorker]", text);
    });

    this.proc.on("error", (err) => {
      console.error("[SpeciesWorker] Process error:", err.message);
      this.fail(new Error(`spawn failed: ${err.message}`));
    });

    this.proc.on("exit", (code) => {
      if (code !== 0) console.error(`[SpeciesWorker] Exited with code ${code}`);
      this.fail(new Error(`worker exited (code ${code})`));
    });

    // Safety net: don't hang startup forever if the model never reports ready.
    setTimeout(() => {
      if (this.readyResolve) {
        this.readyReject?.(new Error("worker startup timed out"));
      }
    }, 180000).unref?.();

    return this.ready;
  }

  private fail(err: Error) {
    this.failed = true;
    this.readyReject?.(err);
    for (const p of this.queue.splice(0)) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.proc = null;
  }

  private onData(chunk: Buffer) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        console.error("[SpeciesWorker] Unparseable output:", line.slice(0, 200));
        continue;
      }

      // Handshake message from the Python side.
      if (msg.type === "ready") {
        if (msg.ok) {
          console.log(
            `[SpeciesWorker] READY — ${msg.kind} model, ${msg.classes ?? "?"} classes, ` +
            `loaded in ${msg.loadMs}ms`
          );
          this.readyResolve?.();
        } else {
          this.fail(new Error(msg.error || "model not ready"));
        }
        continue;
      }

      const pending = this.queue.shift();
      if (pending) {
        clearTimeout(pending.timer);
        pending.resolve(msg);
      }
    }
  }

  /** Classify one base64 image. Resolves with the model's JSON response. */
  classify(image_b64: string, timeoutMs = 60000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.failed || !this.proc) {
        reject(new Error("worker unavailable"));
        return;
      }
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((p) => p.timer === timer);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new Error("classification timed out"));
      }, timeoutMs);

      this.queue.push({ resolve, reject, timer });
      this.proc.stdin.write(JSON.stringify({ image_b64 }) + "\n");
    });
  }

  get isReady() {
    return !this.failed && this.proc !== null;
  }

  stop() {
    try {
      this.proc?.stdin.write(JSON.stringify({ action: "shutdown" }) + "\n");
      this.proc?.kill();
    } catch {
      /* already gone */
    }
    this.proc = null;
  }
}

export const speciesWorker = new SpeciesClassifierWorker();