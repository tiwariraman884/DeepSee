// DeepSea Guardian — ESP32 Full 5-Feature Sensor Gateway (Phase 6B)
// ============================================================
// DS18B20 (1-Wire) + EZO-pH / EZO-DO / EZO-EC (shared I2C) + SEN0189 turbidity
// (conditioned analog) → ONE authenticated POST per cycle into the SAME
// backend pipeline as simulated readings. Incomplete vectors are transmitted
// as telemetry with missing fields omitted (mlReady=false server-side); only
// a fully valid 5-feature vector can become mlReady=true.
//
// Firmware: 0.2.0 — BENCH / CONTROLLED WATER TEST SYSTEM (not deep-sea rated).

#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <ArduinoJson.h>

#include "sensors/SensorTypes.h"
#include "sensors/TemperatureSensor.h"
#include "sensors/PhSensor.h"
#include "sensors/DissolvedOxygenSensor.h"
#include "sensors/SalinitySensor.h"
#include "sensors/TurbiditySensor.h"
#include "transport/ApiClient.h"

#if __has_include("config.h")
#include "config.h"
#else
#error "Copy src/config.example.h to src/config.h and configure it first."
#endif

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "0.2.0"
#endif

// --- Adapters ---------------------------------------------------------------
static TemperatureSensor sTemp(ONEWIRE_PIN);
static PhSensor sPh(EZO_PH_ADDR);
static DissolvedOxygenSensor sDo(EZO_DO_ADDR, DO_PRESSURE_COMPENSATION_ENABLED,
                                 DO_PRESSURE_MBAR);
static SalinitySensor sEc(EZO_EC_ADDR);
static TurbiditySensor::Config sTurbCfg;
static TurbiditySensor *sTurbidity = nullptr;
static ApiClient sApi(BACKEND_URL, DEVICE_ID, DEVICE_KEY, SENSOR_TEST_MODE);

// --- State ------------------------------------------------------------------
static bool sI2cFound[3] = {false, false, false};  // DO, pH, EC
// Device-reported calibration points (-1 = unreadable). EZO calibration
// persists on-chip; turbidity trim persists in NVS; DS18B20 is factory-set.
static int sCalPoints[3] = {-1, -1, -1};  // DO, pH, EC
static unsigned long sBootMs = 0;
static unsigned long sLastSend = 0;
static unsigned long sBackoffMs = RETRY_BASE_MS;
static uint8_t sDiagCounter = 0;

// Bounded offline buffer: newest valid vectors only, max OFFLINE_BUFFER_N.
// Readings carry backend receipt timestamps (no fabricated device time).
struct BufferedVector {
  SensorReading reading;
};
static BufferedVector sOfflineBuf[OFFLINE_BUFFER_N];
static uint8_t sOfflineCount = 0;

// --- I2C bus scan ------------------------------------------------------------
static bool i2cProbe(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

static void scanI2cBus() {
  const uint8_t addrs[3] = {EZO_DO_ADDR, EZO_PH_ADDR, EZO_EC_ADDR};
  for (uint8_t i = 0; i < 3; i++) sI2cFound[i] = i2cProbe(addrs[i]);
}

// Query on-chip calibration state (Phase 6C). -1 survives as "unknown";
// 0 points = CALIBRATION_REQUIRED. Called after warm-up so the bus is stable.
static void queryCalibrationState() {
  if (sI2cFound[0]) sCalPoints[0] = sDo.calibrationPoints();
  if (sI2cFound[1]) sCalPoints[1] = sPh.calibrationPoints();
  if (sI2cFound[2]) sCalPoints[2] = sEc.calibrationPoints();
}

static const char *calState(int points) {
  if (points < 0) return "UNKNOWN";
  return points > 0 ? "CALIBRATED" : "CALIBRATION_REQUIRED";
}

// --- Serial calibration menu -------------------------------------------------
//   CAL PH MID 7 | CAL PH LOW 4 | CAL PH HIGH 10 | CAL PH CLEAR
//   CAL DO | CAL DO ZERO | CAL EC DRY | CAL EC LOW 12880 | CAL EC HIGH 80000
//   TURB CAL <slope> <offset>
static void handleSerialCal() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  line.toUpperCase();
  bool ok = false;
  if (line.startsWith("CAL PH MID ")) ok = sPh.calMid(line.substring(11).toFloat());
  else if (line.startsWith("CAL PH LOW ")) ok = sPh.calLow(line.substring(11).toFloat());
  else if (line.startsWith("CAL PH HIGH ")) ok = sPh.calHigh(line.substring(12).toFloat());
  else if (line == "CAL PH CLEAR") ok = sPh.calClear();
  else if (line == "CAL DO") ok = sDo.calAir();
  else if (line == "CAL DO ZERO") ok = sDo.calZero();
  else if (line == "CAL EC DRY") ok = sEc.calDry();
  else if (line.startsWith("CAL EC LOW ")) ok = sEc.calLow(line.substring(11).toFloat());
  else if (line.startsWith("CAL EC HIGH ")) ok = sEc.calHigh(line.substring(12).toFloat());
  else if (line.startsWith("TURB CAL ")) {
    int sp = line.indexOf(' ', 9);
    if (sp > 0 && sTurbidity) {
      sTurbidity->setTrim(line.substring(9, sp).toFloat(), line.substring(sp + 1).toFloat());
      ok = true;
    }
  } else if (line.length() > 0) {
    Serial.println("[CAL] unknown command");
    return;
  } else {
    return;
  }
  Serial.printf("[CAL] %s: %s\n", line.c_str(), ok ? "sent (verify on device)" : "FAILED");
}

// --- Physical plausibility guards (Phase 6C, bench prototype) -----------------
// Separate from schema validation: per-cycle maximum deltas for a STABLE
// bench sample. Violations mark the reading INVALID (logged, omitted) —
// these are documented prototype guards, not accuracy claims.
static float sLastAccepted[5] = {NAN, NAN, NAN, NAN, NAN};
static const float MAX_DELTA_PER_CYCLE[5] = {
    2.0f,    // temperature °C
    2.0f,    // pH
    5.0f,    // salinity PSU
    3.0f,    // oxygen mg/L
    200.0f,  // turbidity NTU
};

// Returns true when `v` is plausible against history (first reading always passes).
static bool plausible(int idx, float v) {
  if (!isfinite(sLastAccepted[idx])) {
    sLastAccepted[idx] = v;
    return true;
  }
  if (fabsf(v - sLastAccepted[idx]) > MAX_DELTA_PER_CYCLE[idx]) return false;
  sLastAccepted[idx] = v;
  return true;
}

// --- Sensor acquisition (staggered, bus-friendly) -----------------------------
static void acquireVector(SensorReading &v, bool &warming) {
  warming = (millis() - sBootMs) < SENSOR_WARMUP_MS;

  SensorResult t = sTemp.read();
  if (t.ok() && plausible(0, t.value)) {
    v.hasTemperature = true;
    v.temperature = t.value;
  } else if (t.ok()) {
    Serial.println("[PLAUS] temperature jump rejected");
  }

  // EZO reads are skipped entirely for circuits missing from the boot scan —
  // a missing sensor is MISSING, never retried into existence every cycle.
  // (Re-scan is attempted at a controlled interval from loop().)
  if (sI2cFound[1] && v.hasTemperature) {
    SensorResult ph = sPh.read(v.temperature);
    if (ph.ok() && plausible(1, ph.value)) {
      v.hasPh = true;
      v.ph = ph.value;
    } else if (ph.available) {
      Serial.printf("[SENSOR] pH rejected: %s\n", ph.error ? ph.error : "implausible jump");
    }
  }
  if (sI2cFound[2] && v.hasTemperature) {
    SensorResult ec = sEc.read(v.temperature);
    if (ec.ok() && plausible(2, ec.value)) {
      v.hasSalinity = true;
      v.salinity = ec.value;
    } else if (ec.available) {
      Serial.printf("[SENSOR] EC rejected: %s\n", ec.error ? ec.error : "implausible jump");
    }
  }
  if (sI2cFound[0] && v.hasTemperature) {
    float sal = v.hasSalinity ? v.salinity : NAN;
    SensorResult dw = sDo.read(v.temperature, sal);
    if (dw.ok() && plausible(3, dw.value)) {
      v.hasOxygen = true;
      v.oxygen = dw.value;
    } else if (dw.available) {
      Serial.printf("[SENSOR] DO rejected: %s\n", dw.error ? dw.error : "implausible jump");
    }
  }
  if (sTurbidity) {
    SensorResult tb = sTurbidity->read();
    if (tb.ok() && plausible(4, tb.value)) {
      v.hasTurbidity = true;
      v.turbidity = tb.value;
    } else if (tb.available) {
      Serial.printf("[SENSOR] turbidity rejected: %s\n", tb.error ? tb.error : "implausible jump");
    }
  }
}

// --- Diagnostics (throttled, ~1/min) ------------------------------------------
static void sendDiagnostics(const SensorReading &v) {
  JsonDocument diag;
  diag["firmwareVersion"] = FIRMWARE_VERSION;
#if VALIDATION_SESSION_SET
  diag["validationSessionId"] = VALIDATION_SESSION_ID;
#endif
  diag["uptimeSeconds"] = (uint32_t)(millis() / 1000UL);
  diag["wifiRssi"] = WiFi.RSSI();
  diag["pressureSource"] = sDo.pressureSource();
  JsonObject sen = diag["sensors"].to<JsonObject>();
  sen["temperature"] = v.hasTemperature ? "OK" : "MISSING";
  sen["ph"] = v.hasPh ? "OK" : (sI2cFound[1] ? "INVALID" : "MISSING");
  sen["oxygen"] = v.hasOxygen ? "OK" : (sI2cFound[0] ? "INVALID" : "MISSING");
  sen["salinity"] = v.hasSalinity ? "OK" : (sI2cFound[2] ? "INVALID" : "MISSING");
  sen["turbidity"] = v.hasTurbidity ? "OK" : "MISSING";
  JsonObject cal = diag["calibration"].to<JsonObject>();
  cal["temperature"] = "CALIBRATED";  // DS18B20 factory-set (see README)
  cal["ph"] = calState(sCalPoints[1]);
  cal["oxygen"] = calState(sCalPoints[0]);
  cal["salinity"] = calState(sCalPoints[2]);
  cal["turbidity"] = (sTurbidity && sTurbidity->isTrimmed()) ? "CALIBRATED" : "CALIBRATION_REQUIRED";
  PostResult r = sApi.postDiagnostics(diag);
  Serial.printf("[DIAG] posted → %d\n", r.httpCode);
}

// --- Transmit with bounded retry ----------------------------------------------
static bool transmitReading(const SensorReading &v) {
  PostResult r = sApi.postTelemetry(v.temperature, v.hasTemperature, v.ph, v.hasPh,
                                    v.salinity, v.hasSalinity, v.oxygen, v.hasOxygen,
                                    v.turbidity, v.hasTurbidity);
  Serial.printf("[HTTP] POST /api/sensors/ingest → %d (%s)\n", r.httpCode, r.body.c_str());
  if (r.outcome == PostOutcome::ACCEPTED) {
    sBackoffMs = RETRY_BASE_MS;
    return true;
  }
  if (r.outcome == PostOutcome::AUTH_REJECTED) {
    Serial.println("[AUTH] rejected — check DEVICE_ID/DEVICE_KEY, not retrying blindly");
    return false;
  }
  return false;  // rate-limited / server / transport → caller backs off
}

static void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[NET] Connecting to %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000UL) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println(WiFi.status() == WL_CONNECTED ? "[NET] Wi-Fi CONNECTED"
                                               : "[NET] Wi-Fi failed, buffering locally");
}

static void printBootReport() {
  // Structured hardware self-test (Phase 6C): discovery states are observed
  // here, never inferred from configuration. Secrets are never printed.
  bool warming = (millis() - sBootMs) < SENSOR_WARMUP_MS;

  Serial.println();
  Serial.println("╔══════════════════════════════════════╗");
  Serial.println("║ DeepSea ESP32 Hardware Validation   ║");
  Serial.printf("║ Firmware: %-27s ║\n", FIRMWARE_VERSION);
  Serial.println("╚══════════════════════════════════════╝");
  Serial.printf("Device: %s\n", DEVICE_ID);
  Serial.printf("Warm-up: %s\n", warming ? "WARMING_UP" : "READY");
#if VALIDATION_SESSION_SET
  Serial.printf("Validation session: %s\n", VALIDATION_SESSION_ID);
#endif
  Serial.println();
  Serial.println("[1/5] DS18B20");
  Serial.printf("      Device: %s\n", sTemp.detected() ? "DETECTED" : "NOT DETECTED");
  Serial.println("[2/5] EZO-pH");
  Serial.printf("      I2C: 0x%02X\n", EZO_PH_ADDR);
  Serial.printf("      Device: %s\n", sI2cFound[1] ? "DETECTED" : "NOT DETECTED");
  Serial.printf("      Calibration: %s\n", calState(sCalPoints[1]));
  Serial.println("[3/5] EZO-DO");
  Serial.printf("      I2C: 0x%02X\n", EZO_DO_ADDR);
  Serial.printf("      Device: %s\n", sI2cFound[0] ? "DETECTED" : "NOT DETECTED");
  Serial.printf("      Calibration: %s\n", calState(sCalPoints[0]));
  Serial.printf("      Pressure: %s\n", sDo.pressureSource());
  Serial.println("[4/5] EZO-EC");
  Serial.printf("      I2C: 0x%02X\n", EZO_EC_ADDR);
  Serial.printf("      Device: %s\n", sI2cFound[2] ? "DETECTED" : "NOT DETECTED");
  Serial.printf("      Calibration: %s\n", calState(sCalPoints[2]));
  Serial.println("[5/5] Turbidity");
  Serial.println("      ADC: GPIO34");
  Serial.printf("      Input: %s\n",
                (sTurbidity && sTurbidity->detected()) ? "DETECTED" : "NOT DETECTED");
  Serial.printf("      Calibration: %s\n",
                (sTurbidity && sTurbidity->isTrimmed()) ? "CALIBRATED" : "CALIBRATION_REQUIRED");
  Serial.println();
  int found = (sTemp.detected() ? 1 : 0) + (sI2cFound[0] ? 1 : 0) +
              (sI2cFound[1] ? 1 : 0) + (sI2cFound[2] ? 1 : 0) +
              ((sTurbidity && sTurbidity->detected()) ? 1 : 0);
  Serial.printf("Hardware discovery: %s (%d/5)\n", found == 5 ? "PASS" : (found > 0 ? "PARTIAL" : "FAIL"), found);
  Serial.println("Network:");
  Serial.printf("  Wi-Fi %s\n", WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DOWN");
#if SENSOR_TEST_MODE
  Serial.println("MODE: SENSOR TEST MODE (deterministic vectors, X-Device-Mode: test)");
#endif
}

#if SENSOR_TEST_MODE
// Deterministic bench vectors for software integration testing. Marked via
// X-Device-Mode: test → stored as source=hardware_test, never real hardware.
static void testVector(SensorReading &v) {
  static uint8_t step = 0;
  step++;
  v.hasTemperature = v.hasPh = v.hasSalinity = v.hasOxygen = v.hasTurbidity = true;
  v.temperature = 27.0f + 0.1f * (step % 5);
  v.ph = 8.02f;
  v.salinity = 34.6f;
  v.oxygen = 5.1f;
  v.turbidity = 0.8f;
}
#endif

void setup() {
  Serial.begin(115200);
  delay(1000);
  sBootMs = millis();

  sTurbCfg.adcPin = TURBIDITY_ADC_PIN;
  sTurbCfg.rTopOhm = TURB_DIV_R_TOP;
  sTurbCfg.rBotOhm = TURB_DIV_R_BOT;
  sTurbCfg.samples = TURB_SAMPLES;
  static TurbiditySensor turb(sTurbCfg);
  sTurbidity = &turb;

  Wire.begin(I2C_SDA, I2C_SCL);
  sTemp.begin();
  sTurbidity->begin();
  sApi.setDeviceName(DEVICE_NAME);
  connectWifi();
  scanI2cBus();
  queryCalibrationState();
  printBootReport();
  Serial.printf("ML vector: %s\n", "NOT READY (warming up)");
}

void loop() {
  handleSerialCal();
  connectWifi();

  unsigned long now = millis();
  unsigned long interval = READ_INTERVAL_MS + (sBackoffMs > RETRY_BASE_MS ? sBackoffMs : 0);
  if (now - sLastSend < interval) {
    delay(250);
    return;
  }

  // Controlled I2C re-scan (not every cycle — bus-friendly).
  static unsigned long lastScan = 0;
  if (now - lastScan > I2C_RESCAN_MS) {
    scanI2cBus();
    lastScan = now;
  }

  SensorReading v;
  bool warming = false;
#if SENSOR_TEST_MODE
  testVector(v);
#else
  acquireVector(v, warming);
#endif

  if (warming) {
    Serial.println("[STATE] warming up — holding transmission");
    delay(1000);
    return;
  }

  if (!v.hasTemperature && !v.hasPh && !v.hasSalinity && !v.hasOxygen && !v.hasTurbidity) {
    Serial.println("[STATE] no valid sensors — nothing to send (never fabricating)");
    sLastSend = now;
    delay(1000);
    return;
  }

  Serial.printf("[VECTOR] T=%.2f pH=%.2f S=%.2f O2=%.2f NTU=%.2f complete=%d\n",
                v.temperature, v.ph, v.salinity, v.oxygen, v.turbidity, (int)v.complete());

  // Offline buffering: keep newest valid vectors (bounded), send newest first.
  if (WiFi.status() != WL_CONNECTED) {
    if (sOfflineCount < OFFLINE_BUFFER_N) {
      sOfflineBuf[sOfflineCount++].reading = v;
    } else {
      // Drop oldest, keep newest (bounded RAM by design).
      for (uint8_t i = 1; i < OFFLINE_BUFFER_N; i++) sOfflineBuf[i - 1] = sOfflineBuf[i];
      sOfflineBuf[OFFLINE_BUFFER_N - 1].reading = v;
    }
    Serial.printf("[BUFFER] offline, buffered %d/%d\n", sOfflineCount, OFFLINE_BUFFER_N);
    sLastSend = now;
    delay(1000);
    return;
  }
  // Drain buffer newest-first, then the current vector.
  while (sOfflineCount > 0) {
    SensorReading b = sOfflineBuf[--sOfflineCount].reading;
    if (!transmitReading(b)) break;
  }

  if (transmitReading(v)) {
    sLastSend = millis();
    if (++sDiagCounter >= DIAG_EVERY_N_POSTS) {
      sDiagCounter = 0;
      sendDiagnostics(v);
    }
  } else {
    // Bounded exponential backoff: 2s → 4s → 8s → 16s → 30s cap, 5 attempts
    // per cycle, then resume schedule (handled by interval stretch above).
    unsigned long wait = sBackoffMs < RETRY_MAX_MS ? sBackoffMs * 2 : RETRY_MAX_MS;
    sBackoffMs = wait > RETRY_MAX_MS ? RETRY_MAX_MS : wait;
    sLastSend = now;
  }
}
