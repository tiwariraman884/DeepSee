/**
 * DeepSea Sensor Data Pipeline
 * =============================
 * Orchestrates the three pipeline stages:
 *   1. SensorConsumer     — ingests readings, runs ML, persists, broadcasts
 *   2. DroneDispatcher    — selects and dispatches drones on anomaly
 *   3. InspectionSimulator — runs on-site inspection and streams findings
 *
 * This module is now a thin orchestrator — each stage is independently testable.
 */
import { SensorConsumer } from "./pipeline/sensorConsumer";
import { DroneDispatcher } from "./pipeline/droneDispatcher";
import { InspectionSimulator } from "./pipeline/inspectionSimulator";
import { visionPipeline } from "./vision/pipeline";
import { sseManager } from "./sseManager";

let isInitialized = false;
let sensorConsumer: SensorConsumer | null = null;
let droneDispatcher: DroneDispatcher | null = null;
let inspectionSimulator: InspectionSimulator | null = null;

export function initSensorPipeline(): void {
  if (isInitialized) return;
  isInitialized = true;

  console.log("[Pipeline] Sensor data pipeline worker starting...");

  // Stage 1: Consume sensor readings
  sensorConsumer = new SensorConsumer();
  sensorConsumer.start();

  // Stage 2: Dispatch drones on anomaly
  droneDispatcher = new DroneDispatcher();
  droneDispatcher.start();

  // Stage 3: Simulate on-site inspections
  inspectionSimulator = new InspectionSimulator();
  inspectionSimulator.start();

  console.log("[Pipeline] Sensor pipeline active — Consumer → Dispatcher → Inspector");
}

/** Get the drone dispatcher instance (for demo scenario checks). */
export function getDroneDispatcher(): DroneDispatcher | null {
  return droneDispatcher;
}

/** Telemetry: is the three-stage pipeline currently initialized and subscribed? */
export function isSensorPipelineActive(): boolean {
  return isInitialized && sensorConsumer !== null && droneDispatcher !== null && inspectionSimulator !== null;
}

/** Test/QA hook: full teardown of the pipeline worker. */
export function shutdownSensorPipelineForTests(): void {
  sensorConsumer?.stop();
  droneDispatcher?.stop();
  inspectionSimulator?.stop();
  sensorConsumer = null;
  droneDispatcher = null;
  inspectionSimulator = null;
  isInitialized = false;
}

/** Test/QA hook: release the single-mission guard. */
export function resetActiveInspectionGuard(): void {
  droneDispatcher?.resetGuard();
}

/**
 * Test-only: reset active mission state and cancel all pending timers
 * across DroneDispatcher and InspectionSimulator. Does NOT shut down the
 * pipeline — just clears mission lifecycle state so the next test starts clean.
 */
export function resetSensorPipelineForTests(): void {
  droneDispatcher?.resetForTests();
  inspectionSimulator?.resetForTests();
  visionPipeline.resetForTests();
}
