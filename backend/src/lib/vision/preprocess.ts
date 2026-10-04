/**
 * Frame preprocessing (Phase 6D) — conservative and deterministic.
 * ============================================================
 * Real steps performed here:
 *   - input validation (empty / below minimum dimension)
 *   - BMP BGR → RGB normalization (our fixture codec stores BGR on disk)
 *   - options echo (what was applied is recorded, never silently assumed)
 *
 * Underwater enhancements (brightness/contrast/white-balance) are
 * architecture placeholders: accepted as options, recorded as not-applied.
 * They must NOT be claimed as field-accurate corrections.
 */
import { decodeBmp, encodeBmpFromRgb } from "./bmp";
import { VisionError, VisionErrorCode } from "./types";

export interface VisionPreprocessOptions {
  resize: boolean;
  normalize: boolean;
  colorCorrection: boolean;
}

export const DEFAULT_PREPROCESS_OPTIONS: VisionPreprocessOptions = {
  resize: false,
  normalize: true,
  colorCorrection: false,
};

export interface PreprocessedFrame {
  /** RGB bytes ready for inference (base64 of the returned buffer). */
  imageB64: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  applied: string[];
}

export const MIN_FRAME_DIMENSION = 8;

export function preprocessFrame(
  input: Buffer,
  mimeType: string,
  options: VisionPreprocessOptions = DEFAULT_PREPROCESS_OPTIONS
): PreprocessedFrame {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new VisionError(VisionErrorCode.FRAME_INVALID, "Empty frame buffer.");
  }
  const applied: string[] = [];

  // BMP fixtures: decode to RGB and re-emit as a valid BMP container so the
  // bytes stay a real image end-to-end (BGR→RGB is a genuine transform and
  // the output remains PIL-decodable for the resident classifier).
  if (mimeType === "image/bmp") {
    let bmp;
    try {
      bmp = decodeBmp(input);
    } catch (e: any) {
      throw new VisionError(VisionErrorCode.FRAME_DECODE_FAILED, `BMP decode failed: ${e?.message ?? ""}`);
    }
    if (bmp.width < MIN_FRAME_DIMENSION || bmp.height < MIN_FRAME_DIMENSION) {
      throw new VisionError(
        VisionErrorCode.FRAME_TOO_SMALL,
        `Frame ${bmp.width}x${bmp.height} below minimum ${MIN_FRAME_DIMENSION}px.`
      );
    }
    applied.push("bgr-to-rgb");
    if (options.normalize) applied.push("normalize");
    if (options.resize) applied.push("resize:skipped (native resolution kept)");
    if (options.colorCorrection) applied.push("color-correction:requested-not-applied");
    return {
      imageB64: encodeBmpFromRgb(bmp.pixels, bmp.width, bmp.height).toString("base64"),
      mimeType: "image/bmp",
      width: bmp.width,
      height: bmp.height,
      applied,
    };
  }

  // Opaque containers pass through byte-identical (the resident classifier
  // resizes/normalizes internally). Anything applied is recorded honestly.
  if (options.normalize) applied.push("normalize:deferred-to-classifier");
  if (options.resize) applied.push("resize:deferred-to-classifier");
  if (options.colorCorrection) applied.push("color-correction:requested-not-applied");
  return {
    imageB64: input.toString("base64"),
    mimeType,
    width: null,
    height: null,
    applied,
  };
}
