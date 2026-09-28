/**
 * Drone selection tests — deterministic scoring, eligibility, no-drone state.
 */
import {
  selectDrone,
  distanceKm,
  formatEta,
  MIN_BATTERY_PCT,
  DroneCandidate,
} from "../lib/droneSelection";

const drone = (id: string, name: string, lat: number, lng: number, battery: number, status = "idle"): DroneCandidate =>
  ({ id, name, lat, lng, battery, status });

const TARGET = { targetLat: 10, targetLng: 10 };

describe("distanceKm", () => {
  it("is 0 for identical coordinates", () => {
    expect(distanceKm(10, 10, 10, 10)).toBe(0);
  });

  it("computes a plausible haversine distance (Colombo → Singapore ≈ 2730 km)", () => {
    const d = distanceKm(6.93, 79.86, 1.35, 103.82);
    expect(d).toBeGreaterThan(2400);
    expect(d).toBeLessThan(3000);
  });

  it("is symmetric", () => {
    expect(distanceKm(5, 5, 6, 6)).toBeCloseTo(distanceKm(6, 6, 5, 5), 6);
  });
});

describe("selectDrone", () => {
  it("picks the NEAREST eligible drone (not the first row)", () => {
    const far = drone("d1", "Far", 12, 12, 90);
    const near = drone("d2", "Near", 10.05, 10.05, 50);
    const result = selectDrone([far, near], TARGET);
    expect(result?.selected.id).toBe("d2");
    expect(result?.reason).toContain("nearest eligible drone");
  });

  it("is deterministic — identical input, identical choice", () => {
    const candidates = [
      drone("a", "A", 10.1, 10.1, 80),
      drone("b", "B", 10.2, 10.2, 80),
    ];
    const first = selectDrone(candidates, TARGET);
    const second = selectDrone([...candidates].reverse(), TARGET);
    expect(first?.selected.id).toBe(second?.selected.id);
  });

  it("breaks near-ties by battery", () => {
    const close1 = drone("a", "A", 10.01, 10.01, 60);
    const close2 = drone("b", "B", 10.02, 10.02, 90);
    const result = selectDrone([close1, close2], TARGET);
    // A is nearer but the margin is tiny; battery must dominate the tie.
    expect(result?.selected.id).toBe("b");
    expect(result?.reason).toContain("battery");
  });

  it("rejects drones below the battery threshold", () => {
    const low = drone("a", "Low", 10.01, 10.01, MIN_BATTERY_PCT - 1);
    expect(selectDrone([low], TARGET)).toBeNull();
  });

  it("rejects non-idle drones even with full battery", () => {
    const busy = drone("a", "Busy", 10.01, 10.01, 100, "active");
    expect(selectDrone([busy], TARGET)).toBeNull();
  });

  it("returns null (explicit state) when there are no drones at all", () => {
    expect(selectDrone([], TARGET)).toBeNull();
  });

  it("returns null when only ineligible drones exist", () => {
    const candidates = [drone("a", "A", 10, 10, 10, "charging"), drone("b", "B", 11, 11, 90, "offline")];
    expect(selectDrone(candidates, TARGET)).toBeNull();
  });

  it("computes a positive ETA that grows with distance", () => {
    const near = selectDrone([drone("a", "A", 10.05, 10.05, 80)], TARGET);
    const far = selectDrone([drone("a", "A", 11, 11, 80)], TARGET);
    expect(near?.etaSeconds).toBeGreaterThan(0);
    expect(far?.etaSeconds).toBeGreaterThan(near?.etaSeconds ?? 0);
  });
});

describe("formatEta", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatEta(134)).toBe("02:14");
    expect(formatEta(5)).toBe("00:05");
  });
});
