/**
 * Vision frame storage (Phase 6D).
 * ============================================================
 * Local-filesystem implementation behind an abstraction (object storage can
 * replace it later). Only frames the pipeline actually processes are stored,
 * bounded per inspection. Served to clients ONLY through the authenticated
 * frame API — raw filesystem paths are never exposed.
 */
import fs from "fs";
import path from "path";

export interface VisionFrameStorage {
  saveFrame(frameId: string, inspectionId: string, bytes: Buffer, ext: string): string;
  getFrame(frameId: string): { bytes: Buffer; mimeType: string } | null;
  deleteFramesForInspection(inspectionId: string): number;
  countForInspection(inspectionId: string): number;
}

const MIME_TO_EXT: Record<string, string> = {
  "image/bmp": "bmp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  bmp: "image/bmp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function safeId(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("unsafe frame id");
  return id;
}

export class LocalVisionFrameStorage implements VisionFrameStorage {
  readonly maxPerInspection: number;
  private readonly dir: string;

  constructor(dir?: string, maxPerInspection = 20) {
    const base =
      dir ??
      process.env.VISION_FRAME_STORAGE_DIR ??
      path.join(process.cwd(), "..", ".data", "vision-frames");
    this.dir = base;
    this.maxPerInspection = maxPerInspection;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  private filePath(frameId: string, ext: string): string {
    return path.join(this.dir, `${safeId(frameId)}.${ext}`);
  }

  private locate(frameId: string): string | null {
    const id = safeId(frameId);
    for (const ext of Object.keys(EXT_TO_MIME)) {
      const p = path.join(this.dir, `${id}.${ext}`);
      try {
        if (fs.statSync(p).isFile()) return p;
      } catch { /* try next */ }
    }
    return null;
  }

  saveFrame(frameId: string, inspectionId: string, bytes: Buffer, mimeType: string): string {
    const ext = MIME_TO_EXT[mimeType] ?? "bin";
    // Bounded per inspection: prune oldest beyond the cap.
    try {
      const existing = fs
        .readdirSync(this.dir)
        .filter((f) => f.startsWith(`${safeId(inspectionId)}__`))
        .sort();
      while (existing.length >= this.maxPerInspection) {
        const oldest = existing.shift()!;
        try {
          fs.unlinkSync(path.join(this.dir, oldest));
        } catch { /* best-effort */ }
      }
    } catch { /* directory readable check done in ctor */ }
    const storedId = `${safeId(inspectionId)}__${safeId(frameId)}`;
    fs.writeFileSync(path.join(this.dir, `${storedId}.${ext}`), bytes);
    return storedId;
  }

  getFrame(frameId: string): { bytes: Buffer; mimeType: string } | null {
    // Stored ids are namespaced per inspection; locate by suffix match on the
    // sanitized frame id (both direct and namespaced forms supported).
    const direct = this.locate(frameId);
    if (direct) {
      const ext = path.extname(direct).slice(1).toLowerCase();
      return { bytes: fs.readFileSync(direct), mimeType: EXT_TO_MIME[ext] ?? "application/octet-stream" };
    }
    try {
      const match = fs
        .readdirSync(this.dir)
        .filter((f) => f.includes(`__${safeId(frameId)}.`))
        .sort()[0];
      if (!match) return null;
      const ext = path.extname(match).slice(1).toLowerCase();
      return {
        bytes: fs.readFileSync(path.join(this.dir, match)),
        mimeType: EXT_TO_MIME[ext] ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  deleteFramesForInspection(inspectionId: string): number {
    let removed = 0;
    try {
      for (const f of fs.readdirSync(this.dir)) {
        if (f.startsWith(`${safeId(inspectionId)}__`)) {
          try {
            fs.unlinkSync(path.join(this.dir, f));
            removed++;
          } catch { /* best-effort */ }
        }
      }
    } catch { /* ignore */ }
    return removed;
  }

  countForInspection(inspectionId: string): number {
    try {
      return fs.readdirSync(this.dir).filter((f) => f.startsWith(`${safeId(inspectionId)}__`)).length;
    } catch {
      return 0;
    }
  }
}
