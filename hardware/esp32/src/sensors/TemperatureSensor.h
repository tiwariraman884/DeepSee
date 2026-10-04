// DS18B20 temperature probe adapter (Phase 6A hardware, kept as-is).
// OneWire bus on ONEWIRE_PIN (default GPIO4 — never used for I2C).
#pragma once

#include "SensorTypes.h"
#include <OneWire.h>
#include <DallasTemperature.h>

class TemperatureSensor {
 public:
  explicit TemperatureSensor(uint8_t oneWirePin)
      : mOneWire(oneWirePin), mProbe(&mOneWire) {}

  void begin() { mProbe.begin(); }

  bool detected() const { return mProbe.getDeviceCount() > 0; }

  SensorResult read() {
    SensorResult r;
    r.unit = "C";
    if (!detected()) {
      r.error = "probe missing";
      return r;  // available=false, MISSING
    }
    mProbe.requestTemperatures();
    float t = mProbe.getTempCByIndex(0);
    // DS18B20 sentinels: -127 = disconnected, -196.6 = bus fault.
    if (!isfinite(t) || t <= -100.0f) {
      r.available = true;
      r.quality = SensorQuality::INVALID;
      r.error = "bus fault";
      return r;
    }
    r.available = true;
    // Plausibility window matches the backend Zod schema (-5..50 C).
    if (t < -5.0f || t > 50.0f) {
      r.quality = SensorQuality::INVALID;
      r.error = "out of range";
      return r;
    }
    r.valid = true;
    r.value = t;
    r.quality = SensorQuality::OK;
    return r;
  }

 private:
  OneWire mOneWire;
  DallasTemperature mProbe;
};
