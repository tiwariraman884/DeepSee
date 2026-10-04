# ROV Integration Contract (Phase 6D — future)

This document defines interfaces only. No ROV hardware exists, no telemetry
is live, and no vehicle control is implemented or planned without hardware.

## Camera join (future)

```text
ROV camera → RovCameraSource → VisionFrame (sourceType=ROV_CAMERA)
           + RovTelemetry joined by inspectionId + timestamp
```

## Telemetry contract (`RovTelemetry`)

All fields nullable. `null` = NOT PROVIDED (never 0 = a measurement):

`rovId, depthMeters, latitude, longitude, headingDegrees, pitchDegrees,
rollDegrees, speedMetersPerSecond, batteryPercent, connectionState`

## Status

`GET /api/vision/rov/status` → `{ available: false, connected: false,
telemetryAvailable: false, telemetry: {all null} }` until hardware.

## Explicitly out of scope

Motor/thruster commands, depth control, navigation, autonomous underwater
movement, companion-computer protocols. These require an actual hardware
SDK/device, none of which is present in this repository.
