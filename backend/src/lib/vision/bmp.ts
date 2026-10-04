/**
 * Deterministic BMP fixture codec (Phase 6D).
 * ============================================================
 * The fixture camera generates small 24-bit BMP test patterns (no binaries
 * committed to git) and the quality analyzer genuinely decodes them with
 * this reader: real dimensions, real mean luma, real Laplacian sharpness.
 * BMP is used because it is decodable in pure TypeScript with no native
 * dependencies. PIL (the species classifier) reads BMP natively, so the
 * same bytes flow into real MobileNet inference.
 */

export interface DecodedBmp {
  width: number;
  height: number;
  /** Row-major top-down RGB triplets. */
  pixels: Buffer;
}

/** Deterministic test pattern seeded by `seed`: gradient + circle + bars. */
export function generateFixtureBmp(width: number, height: number, seed: number): Buffer {
  const w = Math.max(8, Math.floor(width));
  const h = Math.max(8, Math.floor(height));
  const rowSize = Math.floor((w * 3 + 3) / 4) * 4;
  const pixelBytes = rowSize * h;
  const fileSize = 54 + pixelBytes;
  const buf = Buffer.alloc(fileSize);

  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // pixel offset
  buf.writeUInt32LE(40, 14); // DIB header size
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22); // positive = bottom-up
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  buf.writeUInt32LE(pixelBytes, 34); // image size

  const cx = w * (0.3 + 0.05 * (seed % 5));
  const cy = h * (0.4 + 0.04 * (seed % 7));
  const radius = Math.min(w, h) * 0.22;
  const base = 60 + ((seed * 37) % 120); // deterministic brightness shift

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Vertical gradient + diagonal bars + filled circle (all deterministic).
      let v = base + Math.floor((255 - base) * (y / Math.max(1, h - 1)));
      if (((x + y + seed) % 32) < 4) v = Math.max(0, v - 70);
      const dx = x - cx;
      const dy = y - cy;
      let r = v;
      let g = Math.min(255, v + 20);
      let b = Math.max(0, v - 30);
      if (dx * dx + dy * dy < radius * radius) {
        r = Math.min(255, 90 + seed * 7);
        g = Math.min(255, 140 + seed * 3);
        b = 200;
      }
      // BMP stores bottom-up BGR with 4-byte row padding.
      const off = 54 + (h - 1 - y) * rowSize + x * 3;
      buf[off] = b;
      buf[off + 1] = g;
      buf[off + 2] = r;
    }
  }
  return buf;
}

/** Decode 24-bit uncompressed BMP → top-down RGB. Throws on invalid input. */
export function decodeBmp(buf: Buffer): DecodedBmp {
  if (!Buffer.isBuffer(buf) || buf.length < 54) throw new Error("too small");
  if (buf[0] !== 0x42 || buf[1] !== 0x4d) throw new Error("bad magic");
  const pixelOffset = buf.readUInt32LE(10);
  const dibSize = buf.readUInt32LE(14);
  if (dibSize < 40) throw new Error("unsupported DIB");
  const w = buf.readInt32LE(18);
  const hRaw = buf.readInt32LE(22);
  const planes = buf.readUInt16LE(26);
  const bpp = buf.readUInt16LE(28);
  const compression = buf.readUInt32LE(30);
  if (planes !== 1 || bpp !== 24 || compression !== 0) throw new Error("only 24-bit BI_RGB");
  if (w <= 0 || w > 4096 || hRaw === 0 || Math.abs(hRaw) > 4096) throw new Error("bad dimensions");
  const h = Math.abs(hRaw);
  const bottomUp = hRaw > 0;
  const rowSize = Math.floor((w * 3 + 3) / 4) * 4;
  if (pixelOffset + rowSize * h > buf.length + 1) throw new Error("truncated");

  const pixels = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const srcY = bottomUp ? h - 1 - y : y;
    for (let x = 0; x < w; x++) {
      const s = pixelOffset + srcY * rowSize + x * 3;
      const d = (y * w + x) * 3;
      pixels[d] = buf[s + 2]; // R
      pixels[d + 1] = buf[s + 1]; // G
      pixels[d + 2] = buf[s]; // B
    }
  }
  return { width: w, height: h, pixels };
}

/** Encode top-down RGB triplets as 24-bit BMP (BGR on disk). */
export function encodeBmpFromRgb(pixels: Buffer, w: number, h: number): Buffer {
  if (pixels.length !== w * h * 3) throw new Error("pixel length mismatch");
  const rowSize = Math.floor((w * 3 + 3) / 4) * 4;
  const buf = Buffer.alloc(54 + rowSize * h);
  buf.write("BM", 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(rowSize * h, 34);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 3;
      const d = 54 + (h - 1 - y) * rowSize + x * 3;
      buf[d] = pixels[s + 2];
      buf[d + 1] = pixels[s + 1];
      buf[d + 2] = pixels[s];
    }
  }
  return buf;
}

/** Magic-byte sniff for common containers (no decode). */
export function sniffMimeType(buf: Buffer): string {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return "application/octet-stream";
  if (buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  return "application/octet-stream";
}
