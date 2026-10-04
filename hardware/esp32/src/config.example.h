// DeepSee Guardian — ESP32 compile-time configuration TEMPLATE (Phase 6B).
// ============================================================
// Copy this file to `config.h` and fill in YOUR values:
//   cp src/config.example.h src/config.h
//
// `config.h` is git-ignored — real Wi-Fi credentials and device keys must
// NEVER be committed. Only this template lives in version control.
#pragma once

#include <Arduino.h>

// --- Firmware ---
#define FIRMWARE_VERSION "0.2.0"

// --- Wi-Fi ---
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// --- Backend ---
// IMPORTANT: on a physical ESP32, `localhost` means the ESP32 itself.
// Use the developer machine's LAN IP (or reachable host), e.g.:
//   http://192.168.1.4:5000
#define BACKEND_URL "http://192.168.X.X:5000"

// --- Device identity (must match backend ESP32_DEVICE_KEYS) ---
#define DEVICE_ID "esp32_001"
#define DEVICE_NAME "DeepSea ESP32 Station 001"
#define DEVICE_KEY "YOUR_DEVICE_KEY"

// --- Deployment location (backend seed fallback if GPS unavailable) ---
#define DEVICE_LAT 18.0
#define DEVICE_LNG -77.0

// --- Firmware test mode (bench integration WITHOUT hardware) ---
// true  → deterministic vectors + X-Device-Mode: test header
//         (stored server-side as source=hardware_test, never real hardware)
// false → real sensors only (production behavior)
#define SENSOR_TEST_MODE false

// --- Physical validation session (Phase 6C traceability) ---
// Set to the active VAL-YYYYMMDD-### session while running a documented
// validation session (see hardware-validation/). Empty = no session declared.
// Reported in diagnostics; never invented by the backend.
#define VALIDATION_SESSION_ID ""
#define VALIDATION_SESSION_SET 0

// --- Telemetry schedule ---
// Normal cycle: 12 s (conservative under the backend rate limit).
// EZO circuits need ~1 s per reading — the adapter staggers them, then
// transmits ONE complete vector per cycle (never hammer the bus).
#define READ_INTERVAL_MS 12000UL

// --- Bounded retry/backoff (no retry storms) ---
#define RETRY_BASE_MS 2000UL
#define RETRY_MAX_MS 30000UL
#define RETRY_ATTEMPTS 5

// --- Sensor warm-up (boot: init → warm-up → validation → ready) ---
#define SENSOR_WARMUP_MS 5000UL

// --- DS18B20 OneWire bus (never used for I2C) ---
#define ONEWIRE_PIN 4

// --- Shared I2C bus (EZO-pH / EZO-DO / EZO-EC) ---
#define I2C_SDA 21
#define I2C_SCL 22
#define EZO_DO_ADDR 0x61
#define EZO_PH_ADDR 0x63
#define EZO_EC_ADDR 0x64
// Controlled bus re-scan interval (a missing sensor stays MISSING between scans).
#define I2C_RESCAN_MS 60000UL

// --- EZO-EC probe K value (configure for the probe on hand: K0.1 / K1.0 / K10) ---
// The adapter always sends SALINITY (PSU); low/high calibration reference
// values depend on this K value — see README calibration table.

// --- EZO-DO pressure compensation (no pressure sensor in Phase 6B) ---
// false → pressureSource = "not_measured" (honest default).
// true  → uses DO_PRESSURE_MBAR as an explicitly configured default.
#define DO_PRESSURE_COMPENSATION_ENABLED false
#define DO_PRESSURE_MBAR 1013.0f

// --- SEN0189 turbidity analog front-end ---
// SAFETY: SEN0189 runs on 5 V, output 0–4.5 V. NEVER wire directly to an
// ESP32 ADC pin. Required: voltage divider into an ADC1 pin (ADC1 stays
// usable while Wi-Fi is active; ADC2 does not).
// Default divider R_TOP=20k / R_BOT=39k maps 4.5 V → ~2.97 V.
#define TURBIDITY_ADC_PIN 34  // ADC1-Ch6, input-only
#define TURB_DIV_R_TOP 20000.0f
#define TURB_DIV_R_BOT 39000.0f
#define TURB_SAMPLES 16  // median-filtered, never a single raw sample

// --- Diagnostics + offline buffering ---
#define DIAG_EVERY_N_POSTS 5   // diagnostics POST ~1/min, not every cycle
#define OFFLINE_BUFFER_N 5     // bounded newest-first buffer on Wi-Fi loss
