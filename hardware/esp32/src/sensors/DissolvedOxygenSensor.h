// Atlas Scientific EZO-DO adapter (Phase 6B).
// Requires: EZO-DO circuit + compatible galvanic DO probe (separate).
// Default I2C address 0x61. Supports 1-point (air) and 2-point (air + zero)
// calibration via the serial menu. Temperature AND salinity compensation use
// real measurements (DS18B20 + EZO-EC). Pressure is NOT measured in Phase 6B:
// pressureSource() reports "not_measured" and pressure compensation stays
// disabled unless DO_PRESSURE_COMPENSATION_ENABLED is set with an explicit
// configured default.
#pragma once

#include "SensorTypes.h"
#include "EzoI2c.h"

class DissolvedOxygenSensor {
 public:
  DissolvedOxygenSensor(uint8_t i2cAddress, bool pressureEnabled, float pressureMbar)
      : mAddress(i2cAddress),
        mPressureEnabled(pressureEnabled),
        mPressureMbar(pressureMbar) {}

  const char *pressureSource() const {
    return mPressureEnabled ? "configured_default" : "not_measured";
  }

  // temperatureC: real DS18B20 reading. salinityPsu: real EZO-EC reading
  // (NAN when EC is unavailable — compensation for that channel is skipped).
  SensorResult read(float temperatureC, float salinityPsu) {
    SensorResult r;
    r.unit = "mg/L";
    char cmd[24];
    snprintf(cmd, sizeof(cmd), "T,%.2f", temperatureC);
    EzoI2c::send(mAddress, cmd);
    if (isfinite(salinityPsu)) {
      snprintf(cmd, sizeof(cmd), "S,%.2f", salinityPsu);
      EzoI2c::send(mAddress, cmd);
    }
    if (mPressureEnabled) {
      snprintf(cmd, sizeof(cmd), "P,%.1f", mPressureMbar);
      EzoI2c::send(mAddress, cmd);
    }

    char reply[32];
    if (!EzoI2c::transact(mAddress, "R", reply, sizeof(reply), READ_DELAY_MS)) {
      r.error = "no response";
      return r;
    }
    r.available = true;
    float v = NAN;
    if (!EzoI2c::firstFieldAsFloat(reply, v)) {
      r.quality = SensorQuality::INVALID;
      r.error = "unparseable";
      return r;
    }
    // Plausibility window matches the backend Zod schema (0..20 mg/L).
    if (v < 0.0f || v > 20.0f) {
      r.quality = SensorQuality::INVALID;
      r.error = "out of range";
      return r;
    }
    r.valid = true;
    r.value = v;
    r.quality = SensorQuality::OK;
    return r;
  }

  // "CAL DO" (air saturation) and "CAL DO ZERO" (zero-oxygen solution).
  bool calAir() {
    if (!EzoI2c::send(mAddress, "Cal")) return false;
    delay(1500);
    return true;
  }
  bool calZero() {
    if (!EzoI2c::send(mAddress, "Cal,0")) return false;
    delay(1500);
    return true;
  }

  // Device-reported calibration state ("Cal,?" → "?CAL,n").
  int calibrationPoints() {
    char reply[16];
    if (!EzoI2c::transact(mAddress, "Cal,?", reply, sizeof(reply), 300)) return -1;
    const char *comma = strchr(reply, ',');
    if (!comma) return -1;
    long n = strtol(comma + 1, nullptr, 10);
    return (n >= 0 && n <= 2) ? (int)n : -1;
  }

 private:
  static constexpr unsigned long READ_DELAY_MS = 1000;
  uint8_t mAddress;
  bool mPressureEnabled;
  float mPressureMbar;
};
