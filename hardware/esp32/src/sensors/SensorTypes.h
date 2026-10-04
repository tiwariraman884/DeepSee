// DeepSee ESP32 — shared sensor result types (Phase 6B).
// Every adapter reports availability/validity explicitly so missing or
// invalid hardware NEVER becomes a fabricated zero/default downstream.
#pragma once

#include <Arduino.h>

enum class SensorQuality : uint8_t {
  OK = 0,
  INVALID,               // read succeeded but failed plausibility validation
  MISSING,               // no response on the bus / probe disconnected
  WARMING_UP,            // within the boot warm-up window
  CALIBRATION_REQUIRED,  // adapter knows it was never calibrated
};

struct SensorResult {
  bool available = false;   // hardware answered
  bool valid = false;       // value passed plausibility validation
  float value = NAN;
  const char *unit = "";
  const char *error = nullptr;
  SensorQuality quality = SensorQuality::MISSING;

  bool ok() const { return available && valid; }
};

inline const char *qualityName(SensorQuality q) {
  switch (q) {
    case SensorQuality::OK: return "OK";
    case SensorQuality::INVALID: return "INVALID";
    case SensorQuality::MISSING: return "MISSING";
    case SensorQuality::WARMING_UP: return "WARMING_UP";
    case SensorQuality::CALIBRATION_REQUIRED: return "CALIBRATION_REQUIRED";
  }
  return "UNKNOWN";
}

// Complete 5-feature vector assembled by the main loop. `has*` flags are the
// single source of truth for mlReady — no zero defaults, no hold-last-value
// substitution (there is no sensor-hold policy in Phase 6B).
struct SensorReading {
  bool hasTemperature = false;
  float temperature = NAN;

  bool hasPh = false;
  float ph = NAN;

  bool hasSalinity = false;
  float salinity = NAN;  // PSU (EZO-EC salinity output, never raw EC)

  bool hasOxygen = false;
  float oxygen = NAN;    // mg/L

  bool hasTurbidity = false;
  float turbidity = NAN;  // NTU

  bool complete() const {
    return hasTemperature && hasPh && hasSalinity && hasOxygen && hasTurbidity;
  }
};
