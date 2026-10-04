// Minimal Atlas EZO I2C transaction helper (Phase 6B).
// Protocol (per Atlas EZO documentation): write an ASCII command, wait the
// circuit's response time, then read. Byte 0 of the reply is the status
// (1 = success, 2 = failed, 254 = still processing, 255 = no data),
// bytes 1..N are the CSV payload. No external library required.
#pragma once

#include <Arduino.h>
#include <Wire.h>

namespace EzoI2c {

// Send a command and read the reply into `out` (NUL-terminated).
// Returns true only when the circuit reports status 1 (success).
inline bool transact(uint8_t address, const char *cmd, char *out, size_t outLen,
                     unsigned long responseDelayMs) {
  if (!cmd || !out || outLen < 2) return false;

  Wire.beginTransmission(address);
  Wire.write((const uint8_t *)cmd, strlen(cmd));
  if (Wire.endTransmission() != 0) return false;  // NACK / bus error

  delay(responseDelayMs);

  // EZO replies can exceed the 32-byte Wire buffer; read in chunks.
  size_t pos = 0;
  Wire.requestFrom(address, (uint8_t)64);
  uint8_t status = 255;
  bool first = true;
  while (Wire.available() && pos + 1 < outLen) {
    uint8_t b = Wire.read();
    if (first) {
      status = b;
      first = false;
      continue;
    }
    if (b == 0) break;
    out[pos++] = (char)b;
  }
  out[pos] = '\0';
  return status == 1 && pos > 0;
}

// Fire-and-forget command (calibration, temperature compensation, sleep).
inline bool send(uint8_t address, const char *cmd) {
  Wire.beginTransmission(address);
  Wire.write((const uint8_t *)cmd, strlen(cmd));
  return Wire.endTransmission() == 0;
}

// Parse the first CSV field as float.
inline bool firstFieldAsFloat(const char *csv, float &value) {
  if (!csv || !csv[0]) return false;
  char *end = nullptr;
  float v = strtof(csv, &end);
  if (end == csv || !isfinite(v)) return false;
  value = v;
  return true;
}

// Parse the Nth (0-based) CSV field as float — used for EZO-EC salinity,
// whose "R" reply is "EC,TDS,SAL,SG" (SAL = PSU at index 2).
inline bool fieldAsFloat(const char *csv, int index, float &value) {
  if (!csv || index < 0) return false;
  int cur = 0;
  const char *p = csv;
  while (cur < index) {
    p = strchr(p, ',');
    if (!p) return false;
    p++;
    cur++;
  }
  return firstFieldAsFloat(p, value);
}

}  // namespace EzoI2c
