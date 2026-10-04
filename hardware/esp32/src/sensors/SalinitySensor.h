// Atlas Scientific EZO-EC adapter (Phase 6B).
// Requires: EZO-EC circuit + compatible EC probe, K value matching
// EC_PROBE_K below (K0.1 / K1.0 / K10 — configure for the probe on hand).
// Default I2C address 0x64. The "R" reply is "EC,TDS,SAL,SG"; DeepSee sends
// SAL (PSU, field index 2) — never raw conductivity — as `salinity`.
#pragma once

#include "SensorTypes.h"
#include "EzoI2c.h"

class SalinitySensor {
 public:
  explicit SalinitySensor(uint8_t i2cAddress) : mAddress(i2cAddress) {}

  SensorResult read(float temperatureC) {
    SensorResult r;
    r.unit = "PSU";
    char cmd[16];
    snprintf(cmd, sizeof(cmd), "T,%.2f", temperatureC);
    EzoI2c::send(mAddress, cmd);

    char reply[48];
    if (!EzoI2c::transact(mAddress, "R", reply, sizeof(reply), READ_DELAY_MS)) {
      r.error = "no response";
      return r;
    }
    r.available = true;
    float sal = NAN;
    if (!EzoI2c::fieldAsFloat(reply, 2, sal)) {
      r.quality = SensorQuality::INVALID;
      r.error = "no salinity field";
      return r;
    }
    // Plausibility window matches the backend Zod schema (0..50 PSU).
    if (sal < 0.0f || sal > 50.0f) {
      r.quality = SensorQuality::INVALID;
      r.error = "out of range";
      return r;
    }
    r.valid = true;
    r.value = sal;
    r.quality = SensorQuality::OK;
    return r;
  }

  // "CAL EC DRY" / "CAL EC LOW <us>" / "CAL EC HIGH <us>".
  // Low/high reference values depend on the probe K value — see README.
  bool calDry() {
    if (!EzoI2c::send(mAddress, "Cal,dry")) return false;
    delay(1000);
    return true;
  }
  bool calLow(float microsiemens) { return calPoint("low", microsiemens); }
  bool calHigh(float microsiemens) { return calPoint("high", microsiemens); }

  // Device-reported calibration state ("Cal,?" → "?CAL,n").
  int calibrationPoints() {
    char reply[16];
    if (!EzoI2c::transact(mAddress, "Cal,?", reply, sizeof(reply), 300)) return -1;
    const char *comma = strchr(reply, ',');
    if (!comma) return -1;
    long n = strtol(comma + 1, nullptr, 10);
    return (n >= 0 && n <= 3) ? (int)n : -1;
  }

 private:
  static constexpr unsigned long READ_DELAY_MS = 1000;
  uint8_t mAddress;

  bool calPoint(const char *point, float us) {
    char cmd[32];
    snprintf(cmd, sizeof(cmd), "Cal,%s,%.0f", point, us);
    if (!EzoI2c::send(mAddress, cmd)) return false;
    delay(1000);
    return true;
  }
};
