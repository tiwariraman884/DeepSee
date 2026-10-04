// DFRobot SEN0189 turbidity adapter (Phase 6B).
// SAFETY: the SEN0189 runs on 5 V and its analog output spans ~0–4.5 V.
// It MUST reach the ESP32 through a voltage divider (default design:
// R_TOP=20k, R_BOT=39k → 4.5 V becomes ~2.97 V) into an ADC1 pin
// (default GPIO34 — ADC1 stays usable while Wi-Fi is active; never GPIO4,
// never an ADC2 pin). A direct 4.5 V connection WILL damage the ADC input.
//
// Pipeline: N ADC samples → median → divider-compensated voltage → NTU via
// the configured quadratic curve (DFRobot SEN0189 characteristic, adjustable
// TURBIDITY_CAL_* constants; NVS-backed 2-point user trim recommended —
// the generic curve is NOT laboratory-grade accuracy).
#pragma once

#include "SensorTypes.h"
#include <Preferences.h>
#include <Preferences.h>

class TurbiditySensor {
 public:
  struct Config {
    uint8_t adcPin = 34;          // ADC1-Ch6, input-only, Wi-Fi safe
    int adcResolutionBits = 12;   // 0..4095
    // ESP32 ADC attenuation for the ~0–3.0 V post-divider range.
    adc_attenuation_t attenuation = ADC_11db;
    float vRef = 3.3f;            // ADC reference voltage
    float rTopOhm = 20000.0f;     // divider upper leg (sensor side)
    float rBotOhm = 39000.0f;     // divider lower leg (GND side)
    uint8_t samples = 16;         // median sample count
    uint16_t sampleGapMs = 20;
    // NTU = a*v^2 + b*v + c on the RECONSTRUCTED sensor voltage.
    float calA = -1120.4f;
    float calB = 5742.3f;
    float calC = -4352.9f;
  };

  explicit TurbiditySensor(const Config &cfg) : mCfg(cfg) {}

  void begin() {
    analogReadResolution(mCfg.adcResolutionBits);
    analogSetPinAttenuation(mCfg.adcPin, mCfg.attenuation);
    mPrefs.begin("turb-ntu", true);  // read-only NVS user trim
    mTrimSlope = mPrefs.getFloat("slope", 1.0f);
    mTrimOffset = mPrefs.getFloat("offset", 0.0f);
    mTrimSet = mPrefs.getBool("trimset", false);
    mPrefs.end();
  }

  bool detected() const {
    // ADC presence check: a floating/disconnected divider reads rail noise;
    // treat a pinned rail (all samples at an extreme) as disconnected.
    int lo = 4096, hi = -1;
    for (uint8_t i = 0; i < 8; i++) {
      int v = analogRead(mCfg.adcPin);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      delay(5);
    }
    const int full = (1 << mCfg.adcResolutionBits) - 1;
    return !(lo == 0 && hi == 0) && !(lo == full && hi == full);
  }

  SensorResult read() {
    SensorResult r;
    r.unit = "NTU";
    if (!detected()) {
      r.error = "adc disconnected";
      return r;
    }
    r.available = true;

    // Median of N samples rejects spike noise (never a single raw sample).
    int buf[32];
    uint8_t n = mCfg.samples > 32 ? 32 : mCfg.samples;
    for (uint8_t i = 0; i < n; i++) {
      buf[i] = analogRead(mCfg.adcPin);
      delay(mCfg.sampleGapMs);
    }
    for (uint8_t i = 1; i < n; i++) {
      int key = buf[i], j = i - 1;
      while (j >= 0 && buf[j] > key) {
        buf[j + 1] = buf[j];
        j--;
      }
      buf[j + 1] = key;
    }
    int median = buf[n / 2];

    const float full = float((1 << mCfg.adcResolutionBits) - 1);
    float vAdc = (median / full) * mCfg.vRef;
    // Reconstruct the sensor-side voltage through the divider ratio.
    float vSensor = vAdc * (mCfg.rTopOhm + mCfg.rBotOhm) / mCfg.rBotOhm;
    float ntu = (mCfg.calA * vSensor * vSensor + mCfg.calB * vSensor + mCfg.calC) *
                mTrimSlope +
                mTrimOffset;
    if (ntu < 0) ntu = 0;  // clear-water floor, not a negative reading

    // Plausibility window matches the backend Zod schema (0..1000 NTU).
    if (!isfinite(ntu) || ntu > 1000.0f) {
      r.quality = SensorQuality::INVALID;
      r.error = "out of range";
      return r;
    }
    r.valid = true;
    r.value = ntu;
    r.quality = SensorQuality::OK;
    return r;
  }

  // 2-point user trim stored in NVS: "TURB CAL <slope> <offset>".
  void setTrim(float slope, float offset) {
    mPrefs.begin("turb-ntu", false);
    mPrefs.putFloat("slope", slope);
    mPrefs.putFloat("offset", offset);
    mPrefs.putBool("trimset", true);
    mPrefs.end();
    mTrimSlope = slope;
    mTrimOffset = offset;
    mTrimSet = true;
  }

  // Calibration state: the generic curve works untrimmed, but field accuracy
  // requires a trim against known NTU standards — report honestly.
  bool isTrimmed() const { return mTrimSet; }

 private:
  Config mCfg;
  Preferences mPrefs;
  float mTrimSlope = 1.0f;
  float mTrimOffset = 0.0f;
  bool mTrimSet = false;
};
