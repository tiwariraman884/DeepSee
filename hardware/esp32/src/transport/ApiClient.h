// HTTP transport to the DeepSee backend (Phase 6B).
// One responsibility: authenticated POST of telemetry or diagnostics.
// Retry/backoff policy lives in main.cpp; this client only executes attempts
// and classifies outcomes so the caller can decide (notably: never blindly
// retry 401/403 — those are credential problems, not network problems).
#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

enum class PostOutcome : uint8_t {
  ACCEPTED = 0,       // 202
  AUTH_REJECTED,      // 401/403 — fix credentials, do not retry blindly
  RATE_LIMITED,       // 429 — back off
  SERVER_ERROR,       // 5xx — back off
  TRANSPORT_FAILED,   // connection failure / timeout / unexpected code
};

struct PostResult {
  PostOutcome outcome = PostOutcome::TRANSPORT_FAILED;
  int httpCode = -1;
  String body;
};

class ApiClient {
 public:
  ApiClient(const char *backendUrl, const char *deviceId, const char *deviceKey,
            bool testMode)
      : mBackendUrl(backendUrl),
        mDeviceId(deviceId),
        mDeviceKey(deviceKey),
        mTestMode(testMode) {}

  // Telemetry POST. Only fields with has* == true are included; unavailable
  // features are omitted, never zero-filled. In SENSOR_TEST_MODE the
  // X-Device-Mode: test header marks rows as hardware_test server-side.
  PostResult postTelemetry(float temperature, bool hasTemperature, float ph,
                           bool hasPh, float salinity, bool hasSalinity,
                           float oxygen, bool hasOxygen, float turbidity,
                           bool hasTurbidity) {
    JsonDocument doc;
    doc["sensorId"] = mDeviceId;
    doc["sensorName"] = mDeviceName;
    if (hasTemperature) doc["temperature"] = temperature;
    if (hasPh) doc["ph"] = ph;
    if (hasSalinity) doc["salinity"] = salinity;
    if (hasOxygen) doc["oxygen"] = oxygen;
    if (hasTurbidity) doc["turbidity"] = turbidity;
    String body;
    serializeJson(doc, body);
    return post("/api/sensors/ingest", body);
  }

  // Diagnostics POST (throttled by the caller, ~1/min). Accepted and logged
  // server-side; never creates sensor readings.
  PostResult postDiagnostics(const JsonDocument &diag) {
    String body;
    serializeJson(diag, body);
    return post("/api/sensors/diagnostics", body);
  }

  void setDeviceName(const char *name) { mDeviceName = name; }

 private:
  const char *mBackendUrl;
  const char *mDeviceId;
  const char *mDeviceKey;
  const char *mDeviceName = "";
  bool mTestMode;

  PostResult post(const char *path, const String &body) {
    PostResult r;
    if (WiFi.status() != WL_CONNECTED) return r;
    HTTPClient http;
    http.begin(String(mBackendUrl) + path);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Id", mDeviceId);
    http.addHeader("X-Device-Key", mDeviceKey);
    if (mTestMode) http.addHeader("X-Device-Mode", "test");
    http.setTimeout(8000);
    r.httpCode = http.POST(body);
    r.body = http.getString();
    http.end();

    if (r.httpCode == 202) r.outcome = PostOutcome::ACCEPTED;
    else if (r.httpCode == 401 || r.httpCode == 403)
      r.outcome = PostOutcome::AUTH_REJECTED;
    else if (r.httpCode == 429)
      r.outcome = PostOutcome::RATE_LIMITED;
    else if (r.httpCode >= 500 && r.httpCode < 600)
      r.outcome = PostOutcome::SERVER_ERROR;
    else
      r.outcome = PostOutcome::TRANSPORT_FAILED;
    return r;
  }
};
