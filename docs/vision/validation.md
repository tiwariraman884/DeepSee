# Vision Validation (Phase 6D)

## Software integration — VERIFIED (Jest, no hardware)

- Frame contract + provenance enum separation (test vs hardware sources).
- Fixture determinism (same seed → identical bytes) and sequence bounds.
- Invalid/corrupt/undersized frames rejected with machine-readable codes.
- Bounded queue (max 3 default), drop accounting, sampling gate.
- Camera lifecycle (connect/disconnect/status) for all adapters.
- Shared `analyseFrame` reference reused (no duplicate ML logic).
- Evidence rows carry `frame_id` + `source_type`; incident reports expose
  frame counts + representative frame; intelligence exposes session counters.
- USB missing → `UNAVAILABLE`/`CAMERA_DEVICE_NOT_FOUND`, never fixture fallback.
- RTSP config validated offline; credentials redacted.
- Simulated inspection regression: existing suites + live emergency scenario.
- Idempotent shutdown; no EventBus listener leaks; no open handles.

## Physical camera validation — PARTIAL (Phase 6E, normal webcam only)

2026-09-29, Lenovo laptop Integrated Camera (640×480 @ DirectShow index 0):
device discovery, real JPEG capture with capture-time timestamps,
deterministic sequencing, measured FPS/latency, bounded-queue drops,
resident MobileNet inference on real bytes, USB_CAMERA evidence linkage,
clean repeated connect/disconnect, `vision:camera:test` PASS (exit 0).
NOT validated: underwater enclosure/camera, ROV, depth/pressure/saltwater,
underwater accuracy — all remain NOT DONE by explicit rule.

## Underwater validation — NOT PERFORMED

No enclosure/camera, no controlled water test, no visibility/turbidity/
lighting/color/focus evaluation, no underwater species-inference assessment.

## Allowed language

"Software camera ingestion architecture implemented." · "Hardware adapter
ready for validation." · "Fixture-based end-to-end vision path verified." ·
"Physical camera validation pending." · "Underwater field performance not
yet measured."

## Prohibited (unenforceable today)

Any claim of tested/operational/validated real cameras, ROV telemetry,
depth capability, underwater accuracy, or saltwater deployment.
