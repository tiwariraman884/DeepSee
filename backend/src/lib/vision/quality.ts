/**
 * Frame quality analyzer (Phase 6D).
 * ============================================================
 * Measures what is genuinely measurable:
 *   - BMP fixtures: decoded pixels → real width/height/brightness/sharpness.
 *   - JPEG/PNG/WEBP (e.g. simulation sample frames): magic-sniffed container
 *     only — dims/brightness/sharpness stay null, NEVER guessed.
 *
 * Thresholds are documented engineering heuristics (not calibrated science):
 *   LOW_RESOLUTION: max(dim) < 320
 *   LOW_LIGHT:      mean luma < 40
 *   BLURRY:         Laplacian variance < 30 (on ≤64px downsampled grayscale)
 */
import { decodeBmp, sniffMimeType } from "./bmp";
import { VisionQualityStatus, type VisionFrameQuality, type VisionQualityStatus as VisionQualityStatusType } from "./types";

const LOW_RESOLUTION_MAX_DIM = 320;
const LOW_LIGHT_LUMA = 40;
const BLURRY_LAPLACIAN_VAR = 30;

function lumaMean(pixels: Buffer): number {
  let sum = 0;
  const n = pixels.length / 3;
  for (let i = 0; i < pixels.length; i += 3) {
    sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  }
  return n === 0 ? 0 : sum / n;
}

/** Variance of the Laplacian on a ≤64px grayscale downsample. */
function laplacianVariance(pixels: Buffer, w: number, h: number): number {
  const dw = Math.min(64, w);
  const dh = Math.max(1, Math.round((dw / w) * h));
  const gray = new Float64Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(w - 1, Math.floor((x / dw) * w));
      const sy = Math.min(h - 1, Math.floor((y / dh) * h));
      const o = (sy * w + sx) * 3;
      gray[y * dw + x] = 0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2];
    }
  }
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < dh - 1; y++) {
    for (let x = 1; x < dw - 1; x++) {
      let v = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          v += gray[(y + ky) * dw + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.max(0, sumSq / n - mean * mean);
}

export function analyzeFrameQuality(input: Buffer, mimeHint?: string): VisionFrameQuality {
  const byteSize = Buffer.isBuffer(input) ? input.length : 0;
  const mimeType = mimeHint ?? sniffMimeType(input);
  const invalid = (note: string): VisionFrameQuality => ({
    width: null,
    height: null,
    brightness: null,
    sharpness: null,
    byteSize,
    mimeType,
    validFrame: false,
    qualityStatus: VisionQualityStatus.INVALID,
    qualityNote: note,
  });

  if (!Buffer.isBuffer(input) || input.length === 0) {
    return invalid("Empty frame buffer.");
  }
  if (mimeType === "application/octet-stream") {
    return invalid("Unrecognized container (magic-byte sniff failed).");
  }

  // Pixel-decodable path: our own BMP fixtures → measured values.
  if (mimeType === "image/bmp") {
    try {
      const bmp = decodeBmp(input);
      const brightness = lumaMean(bmp.pixels);
      const sharpness = laplacianVariance(bmp.pixels, bmp.width, bmp.height);
      let status: VisionQualityStatusType = VisionQualityStatus.GOOD;
      let note = "Measured from decoded pixels (fixture BMP).";
      if (Math.max(bmp.width, bmp.height) < LOW_RESOLUTION_MAX_DIM) {
        status = VisionQualityStatus.LOW_RESOLUTION;
        note = `Max dimension ${Math.max(bmp.width, bmp.height)}px < ${LOW_RESOLUTION_MAX_DIM}px heuristic.`;
      } else if (brightness < LOW_LIGHT_LUMA) {
        status = VisionQualityStatus.LOW_LIGHT;
        note = `Mean luma ${brightness.toFixed(1)} < ${LOW_LIGHT_LUMA} heuristic.`;
      } else if (sharpness < BLURRY_LAPLACIAN_VAR) {
        status = VisionQualityStatus.BLURRY;
        note = `Laplacian variance ${sharpness.toFixed(1)} < ${BLURRY_LAPLACIAN_VAR} heuristic.`;
      }
      return {
        width: bmp.width,
        height: bmp.height,
        brightness: Math.round(brightness * 10) / 10,
        sharpness: Math.round(sharpness * 10) / 10,
        byteSize,
        mimeType,
        validFrame: true,
        qualityStatus: status,
        qualityNote: note,
      };
    } catch (e: any) {
      return invalid(`BMP decode failed: ${e?.message ?? "corrupt"}.`);
    }
  }

  // Opaque containers (JPEG/PNG/WEBP simulation samples): container-level
  // validity only. Dimensions and pixel metrics are NOT measurable here and
  // stay null rather than fabricated.
  if (byteSize < 1024) {
    return invalid(`Suspiciously small ${mimeType} payload (${byteSize} bytes).`);
  }
  return {
    width: null,
    height: null,
    brightness: null,
    sharpness: null,
    byteSize,
    mimeType,
    validFrame: true,
    qualityStatus: VisionQualityStatus.GOOD,
    qualityNote: `Container-level validity only (${mimeType}); pixel metrics not measurable without a decoder.`,
  };
}
