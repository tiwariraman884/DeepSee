/**
 * Device Diagnostics Registry (Phase 6B).
 * ============================================================
 * Session-scoped store for the latest self-reported diagnostics per device
 * (firmware version, RSSI, uptime, per-sensor availability, pressure source).
 * Reported BY the device, never invented backend-side; resets on restart
 * (labeled session state in the UI). No timers, no SQLite, no memory leak:
 * one small record per known device ID.
 */

export interface DeviceSensorStates {
  [sensor: string]: string;
}

export interface DeviceDiagnostics {
  deviceId: string;
  firmwareVersion: string | null;
  validationSessionId: string | null;
  uptimeSeconds: number | null;
  wifiRssi: number | null;
  pressureSource: string | null;
  sensors: DeviceSensorStates;
  calibration: DeviceSensorStates;
  reportedAt: string;
}

const registry = new Map<string, DeviceDiagnostics>();

export function recordDeviceDiagnostics(
  deviceId: string,
  input: {
    firmwareVersion?: unknown;
    validationSessionId?: unknown;
    uptimeSeconds?: unknown;
    wifiRssi?: unknown;
    pressureSource?: unknown;
    sensors?: unknown;
    calibration?: unknown;
  }
): DeviceDiagnostics {
  const str = (v: unknown, max = 64): string | null =>
    typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const cleanMap = (v: unknown): DeviceSensorStates => {
    const out: DeviceSensorStates = {};
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (/^[a-zA-Z0-9_]{1,32}$/.test(k)) out[k] = str(val, 32) ?? "UNKNOWN";
      }
    }
    return out;
  };

  const record: DeviceDiagnostics = {
    deviceId,
    firmwareVersion: str(input.firmwareVersion, 32),
    validationSessionId: str(input.validationSessionId, 24),
    uptimeSeconds: num(input.uptimeSeconds),
    wifiRssi: num(input.wifiRssi),
    pressureSource: str(input.pressureSource, 32),
    sensors: cleanMap(input.sensors),
    calibration: cleanMap(input.calibration),
    reportedAt: new Date().toISOString(),
  };
  registry.set(deviceId, record);
  return record;
}

export function getDeviceDiagnostics(deviceId: string): DeviceDiagnostics | null {
  return registry.get(deviceId) ?? null;
}

/** Test-only: clear session diagnostics. */
export function resetDeviceRegistryForTests(): void {
  registry.clear();
}
