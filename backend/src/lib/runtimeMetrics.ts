/**
 * Runtime Telemetry — bounded in-memory rolling metrics (Step 5).
 * ================================================================
 * Session-scoped operational telemetry only: ML inference latency and total
 * sensor-to-alert pipeline latency, recorded from the REAL anomaly pipeline.
 *
 *   - Bounded: at most MAX_SAMPLES recent values per series (no memory leak,
 *     no SQLite writes — this is runtime telemetry, not business data).
 *   - Resets on backend restart (labeled "Runtime session telemetry" in UI).
 *   - ML inference latency (model round-trip) is tracked SEPARATELY from total
 *     sensor-to-alert latency (inference + persist + broadcast). Never conflate.
 */

const MAX_SAMPLES = 200;

const mlInferenceMs: number[] = [];
const pipelineMs: number[] = [];

function pushBounded(series: number[], value: number): void {
  if (!Number.isFinite(value) || value < 0) return;
  series.push(value);
  if (series.length > MAX_SAMPLES) {
    series.splice(0, series.length - MAX_SAMPLES);
  }
}

export interface LatencyStats {
  currentMs: number | null;
  averageMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  sampleCount: number;
}

function summarize(series: number[]): LatencyStats {
  if (series.length === 0) {
    return { currentMs: null, averageMs: null, minMs: null, maxMs: null, sampleCount: 0 };
  }
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of series) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    currentMs: series[series.length - 1],
    averageMs: Math.round((sum / series.length) * 10) / 10,
    minMs: min,
    maxMs: max,
    sampleCount: series.length,
  };
}

/** Record one resident-model inference round-trip (mlWorker.predict latency_ms). */
export function recordMlInferenceLatency(ms: number): void {
  pushBounded(mlInferenceMs, ms);
}

/** Record one end-to-end sensor-reading → alert pipeline pass (wall clock). */
export function recordPipelineLatency(ms: number): void {
  pushBounded(pipelineMs, ms);
}

export function getMlInferenceStats(): LatencyStats {
  return summarize(mlInferenceMs);
}

export function getPipelineStats(): LatencyStats {
  return summarize(pipelineMs);
}

export function getMaxSamples(): number {
  return MAX_SAMPLES;
}

/** Test-only: clear session telemetry. */
export function resetRuntimeMetricsForTests(): void {
  mlInferenceMs.length = 0;
  pipelineMs.length = 0;
}
