# Camera Setup (Phase 6D)

## Fixture camera (works now — no hardware)

```bash
VISION_SOURCE=fixture          # deterministic stills (default fallback)
VISION_SOURCE=fixture-video    # deterministic 30-frame BMP sequences
VISION_SOURCE=simulated        # legacy sample-frame flow (inspections default)
```

No binaries, no devices, fully repeatable. Frames are generated BMP patterns;
quality metrics are genuinely measured from decoded pixels.

## USB/UVC camera (hardware required — see Phase 6E)

1. Attach a UVC-compliant USB camera to the backend host (Windows: DirectShow;
   Linux: V4L2 via OpenCV — backend shells to `backend/scripts/vision-capture.py`,
   Python + `opencv-python` required, no native Node modules).
2. Set `VISION_CAMERA_DEVICE` to the device index (`0`) or a name substring.
   Optional: `VISION_CAMERA_WIDTH` / `VISION_CAMERA_HEIGHT` (0 = native),
   `VISION_CAMERA_FPS` (informational only — FPS is always measured, §6E).
3. `GET /api/vision/status` shows `USB_CAMERA` + `connected: true` with measured
   `deviceInfo` (index, name, native resolution) only for a real device.
4. Without a device: `UNAVAILABLE` / `CAMERA_DEVICE_NOT_FOUND`. The system
   never silently substitutes fixture frames.
5. Smoke test: `npm --prefix backend run vision:camera:test -- --frames 20`
   (exit 0 PASS · 2 NO_CAMERA · 1 FAILURE). Validated 2026-09-29 on a Lenovo
   laptop Integrated Camera: 8 frames, measured FPS 1.09 (per-capture process
   spawn dominates; streaming optimization is future work), avg capture
   121.6 ms, avg MobileNet inference 76.3 ms, 3 processed / 5 dropped
   (bounded queue of 3 + 500 ms sampling — backpressure as designed).

## Switching sources at runtime

`POST /api/vision/source` with `{ "source": "simulated" | "fixture" |
"fixture-video" | "usb" | "rtsp" | "rov" }`. Unavailable hardware targets
are rejected with 409 and the previous source stays active — silent fallback
to fixture/simulation is forbidden. The System Intelligence camera panel
exposes the same switcher.

## RTSP / MJPEG (configuration only in Phase 6D)

```bash
VISION_RTSP_URL=rtsp://user:***@camera.local:8554/stream   # never commit this
```

- Missing/malformed URL → `CAMERA_NOT_CONFIGURED` (validated without network).
- Reachable URL → adapter reports `UNAVAILABLE` / `CAMERA_STREAM_UNAVAILABLE`
  until live streaming is implemented; passwords are redacted in logs/UI.
- No WebRTC, no signalling servers in this phase.

## ROV camera

Reserved: `ROV_CAMERA` source type + `GET /api/vision/rov/status` (always
`connected: false` until hardware). Telemetry contract is all-nullable;
`null` means NOT PROVIDED, never zero. No motor/thruster/depth control exists
and none is planned without an actual hardware SDK.
