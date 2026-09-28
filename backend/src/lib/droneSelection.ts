/**
 * Drone Selection — deterministic, explainable dispatch decision.
 * ================================================================
 * Pure module (no DB, no SSE) so it is trivially unit-testable.
 *
 * The pipeline previously selected "an idle drone" (battery-sorted fallback to
 * any drone), which did not justify the "nearest available drone" claim in the
 * UI. Selection is now a scored, deterministic decision over:
 *
 *   - availability  (idle only, hard requirement)
 *   - battery       (must exceed MIN_BATTERY_PCT, hard requirement)
 *   - distance      (haversine km from drone to anomaly)
 *
 * Score = distance_score (closer is better, saturates at 50 km)
 *       + battery_score  (higher is better, saturates at 100%)
 * Weights favour distance 3:1 — proximity dominates, battery breaks ties.
 */

export interface DroneCandidate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  battery: number;
  status: string;
}

export interface SelectionInput {
  targetLat: number;
  targetLng: number;
  /** Cruise speed used for the ETA estimate (knots). */
  cruiseSpeedKnots?: number;
}

export interface SelectionResult {
  selected: DroneCandidate;
  distanceKm: number;
  etaSeconds: number;
  /** Human-readable justification for the choice ("nearest eligible drone"). */
  reason: string;
  /** All candidates considered, sorted best-first (for UI/debug). */
  ranked: { drone: DroneCandidate; distanceKm: number; score: number }[];
}

/** Minimum battery for a drone to be eligible for an inspection mission. */
export const MIN_BATTERY_PCT = 35;
const MAX_DISTANCE_KM = 50;
const DEFAULT_CRUISE_KNOTS = 4.5;

/** Haversine distance in kilometres. */
export function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function score(distance: number, battery: number): number {
  const distanceScore = 1 - Math.min(1, distance / MAX_DISTANCE_KM);
  const batteryScore = Math.max(0, Math.min(1, battery / 100));
  return distanceScore * 3 + batteryScore * 1;
}

/**
 * Pick the best eligible drone. Deterministic: identical inputs always yield
 * the identical choice (ties broken by id lexicographic order).
 * Returns null when no drone is eligible — callers must surface that state
 * instead of silently dispatching an unfit drone.
 */
export function selectDrone(
  candidates: DroneCandidate[],
  input: SelectionInput
): SelectionResult | null {
  const eligible = candidates.filter(
    (d) => d.status === "idle" && d.battery >= MIN_BATTERY_PCT
  );
  if (eligible.length === 0) return null;

  const cruise = input.cruiseSpeedKnots ?? DEFAULT_CRUISE_KNOTS;
  const ranked = eligible
    .map((drone) => {
      const d = distanceKm(drone.lat, drone.lng, input.targetLat, input.targetLng);
      return { drone, distanceKm: d, score: score(d, drone.battery) };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.distanceKm - b.distanceKm ||
        a.drone.id.localeCompare(b.drone.id)
    );

  const best = ranked[0];
  // Straight-line speed → time; nautical conversion: 1 kn = 1.852 km/h.
  const etaSeconds = Math.max(1, Math.round((best.distanceKm / (cruise * 1.852)) * 3600));

  const runnerUp = ranked[1];
  const reason =
    runnerUp && runnerUp.distanceKm - best.distanceKm < 0.5
      ? `nearest eligible drone (battery tie-break: ${best.drone.battery}% vs ${runnerUp.drone.battery}%)`
      : "nearest eligible drone";

  return {
    selected: best.drone,
    distanceKm: Math.round(best.distanceKm * 10) / 10,
    etaSeconds,
    reason,
    ranked,
  };
}

/** Format seconds as mm:ss for UI/telemetry. */
export function formatEta(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
