// Atlas Scientific EZO-pH adapter (Phase 6B).
// Requires: EZO-pH circuit + compatible pH probe (separate components).
// Default I2C address 0x63. Supports 1/2/3-point calibration, performed via
// the serial calibration menu (never hard-coded offsets).
#pragma once

#include "SensorTypes.h"
#include "EzoI2c.h"

class PhSensor {
 public:
  explicit PhSensor(uint8_t i2cAddress) : mAddress(i2cAddress) {}

  // Read with DS18B20 temperature compensation applied first.
  SensorResult read(float temperatureC) {
    SensorResult r;
    r.unit = "pH";
    char cmd[16];
    snprintf(cmd, sizeof(cmd), "T,%.2f", temperatureC);
    EzoI2c::send(mAddress, cmd);  // best-effort compensation, ignore NACK here

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
    // Plausibility window matches the backend Zod schema (0..14).
    if (v < 0.0f || v > 14.0f) {
      r.quality = SensorQuality::INVALID;
      r.error = "out of range";
      return r;
    }
    r.valid = true;
    r.value = v;
    r.quality = SensorQuality::OK;
    return r;
  }

  // Calibration passthroughs for the serial menu ("CAL PH ...").
  bool calMid(float v) { return calPoint("mid", v); }
  bool calLow(float v) { return calPoint("low", v); }
  bool calHigh(float v) { return calPoint("high", v); }
  bool calClear() {
    EzoI2c::send(mAddress, "Cal,clear");
    delay(300);
    return true;  // EZO stores calibration on-chip; verify via "Cal,?" on device
  }

  // Device-reported calibration state ("Cal,?" → "?CAL,n").
  // Returns: points count (0 = uncalibrated), or -1 when unreadable.
  int calibrationPoints() {
    char reply[16];
    if (!EzoI2c::transact(mAddress, "Cal,?", reply, sizeof(reply), 300)) return -1;
    // Reply form "?CAL,n".
    const char *comma = strchr(reply, ',');
    if (!comma) return -1;
    long n = strtol(comma + 1, nullptr, 10);
    return (n >= 0 && n <= 3) ? (int)n : -1;
  }

 private:
  static constexpr unsigned long READ_DELAY_MS = 1000;
  uint8_t mAddress;

  bool calPoint(const char *point, float v) {
    char cmd[32];
    snprintf(cmd, sizeof(cmd), "Cal,%s,%.2f", point, v);
    if (!EzoI2c::send(mAddress, cmd)) return false;
    delay(1000);  // calibration write needs settling time
    return true;
  }
};
