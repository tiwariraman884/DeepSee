/**
 * Mission-guard lifecycle tests — DroneDispatcher single-mission guard vs.
 * the internal DRONE_INSPECTION_COMPLETED EventBus handshake.
 *
 *   Case A — active mission blocks a second dispatch (suppression preserved)
 *   Case B — matching completion releases the guard; next dispatch proceeds
 *   Case C — unrelated completion does NOT clear the active mission
 *   Case D — stop/start leaves no duplicate completion subscriptions
 *
 * All dispatch triggers publish ML_ANOMALY directly (synchronous delivery),
 * so no ML worker, timers, or waits are involved. Flight intervals started
 * by dispatches are cancelled in afterEach/afterAll — no open handles.
 */
import { DroneDispatcher } from "../lib/pipeline/droneDispatcher";
import { InspectionSimulator } from "../lib/pipeline/inspectionSimulator";
import { eventBus, TOPICS, AnomalyEvent, InspectionCompletedEvent } from "../lib/eventBus";
import { getDb } from "../db";

const dispatcher = new DroneDispatcher();
const simulator = new InspectionSimulator();

function anomalyEvent(): AnomalyEvent {
  const ts = new Date().toISOString();
  return {
    sensorId: "sensor_001",
    sensorName: "Temp Station Alpha",
    isAnomaly: true,
    score: -0.77,
    latency_ms: 10,
    reading: {
      sensorId: "sensor_001",
      sensorName: "Temp Station Alpha",
      temperature: 3.1, ph: 5.8, salinity: 34.5, oxygen: 1.5, turbidity: 18.0,
      timestamp: ts,
    },
    timestamp: ts,
  };
}

function completionFor(inspectionId: string): InspectionCompletedEvent {
  return { inspectionId, droneId: "drone-test", timestamp: new Date().toISOString() };
}

/**
 * Test-only write helper: the shared file DB can be momentarily write-locked
 * by straggler callbacks from a previous suite (separate DB connection in the
 * same process) or a concurrently running dev server. Retry briefly instead
 * of flaking. Production code is untouched.
 */
function dbWrite<T>(fn: () => T, attempts = 10): T {
  let last: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (e: any) {
      last = e;
      if (!/locked|busy/i.test(e?.message ?? "")) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  throw last;
}

function resetFleetIdle(): void {
  dbWrite(() => getDb().prepare("UPDATE drones SET status = 'idle', battery = MAX(battery, 90)").run());
}

beforeAll(() => {
  dispatcher.start();
  simulator.start();
});

afterAll(() => {
  dispatcher.stop();
  simulator.stop();
  eventBus.clear();
  // Leave the shared fleet DB as we found it (idle) for other suites.
  dbWrite(() => getDb().prepare("UPDATE drones SET status = 'idle'").run());
});

beforeEach(() => {
  resetFleetIdle();
  dispatcher.resetForTests();
  simulator.resetForTests();
  eventBus.clear();
});

afterEach(() => {
  dispatcher.resetForTests();
  simulator.resetForTests();
  eventBus.clear();
});

describe("mission guard lifecycle", () => {
  it("Case A — active mission blocks a second dispatch", () => {
    eventBus.publish<AnomalyEvent>(TOPICS.ML_ANOMALY, anomalyEvent());
    const first = dispatcher.getActiveInspectionId();
    expect(first).toBeTruthy();

    // Second anomaly while A is active → suppressed, guard keeps A's id.
    eventBus.publish<AnomalyEvent>(TOPICS.ML_ANOMALY, anomalyEvent());
    expect(dispatcher.getActiveInspectionId()).toBe(first);
    expect(dispatcher.isInspectionActive()).toBe(true);
  });

  it("Case C — unrelated completion does not clear the active mission", () => {
    eventBus.publish<AnomalyEvent>(TOPICS.ML_ANOMALY, anomalyEvent());
    const active = dispatcher.getActiveInspectionId();
    expect(active).toBeTruthy();

    eventBus.publish<InspectionCompletedEvent>(
      TOPICS.DRONE_INSPECTION_COMPLETED,
      completionFor("insp-unrelated-stale-id")
    );
    expect(dispatcher.getActiveInspectionId()).toBe(active);
    expect(dispatcher.isInspectionActive()).toBe(true);
  });

  it("Case B — matching completion releases the guard; next dispatch proceeds immediately", () => {
    eventBus.publish<AnomalyEvent>(TOPICS.ML_ANOMALY, anomalyEvent());
    const first = dispatcher.getActiveInspectionId();
    expect(first).toBeTruthy();

    eventBus.publish<InspectionCompletedEvent>(
      TOPICS.DRONE_INSPECTION_COMPLETED,
      completionFor(first!)
    );
    expect(dispatcher.getActiveInspectionId()).toBeNull();
    expect(dispatcher.isInspectionActive()).toBe(false);

    // No 120s wait: the very next anomaly dispatches a NEW inspection.
    eventBus.publish<AnomalyEvent>(TOPICS.ML_ANOMALY, anomalyEvent());
    const second = dispatcher.getActiveInspectionId();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it("Case D — stop/start leaves no duplicate completion subscriptions", () => {
    dispatcher.stop();
    expect(eventBus.listenerCount(TOPICS.DRONE_INSPECTION_COMPLETED)).toBe(0);
    expect(eventBus.listenerCount(TOPICS.ML_ANOMALY)).toBe(0);

    dispatcher.start();
    dispatcher.start();
    expect(eventBus.listenerCount(TOPICS.DRONE_INSPECTION_COMPLETED)).toBe(1);
    expect(eventBus.listenerCount(TOPICS.ML_ANOMALY)).toBe(1);

    // Functionality restored after restart.
    eventBus.publish<AnomalyEvent>(TOPICS.ML_ANOMALY, anomalyEvent());
    expect(dispatcher.getActiveInspectionId()).toBeTruthy();
  });
});
