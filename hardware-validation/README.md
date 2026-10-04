# DeepSee Hardware Validation (Phase 6C)

Physical validation records for the ESP32 5-feature sensor gateway.
Every claim here must be traceable to an observed session — **never report a
physical result that was not physically observed.**

## Statuses

| Status | Meaning |
|---|---|
| `PHYSICALLY VERIFIED` | Observed on real hardware in a logged session |
| `SOFTWARE VERIFIED` | Proven by backend/frontend integration tests only |
| `NOT PERFORMED` | Not yet done — no claim is made |

## Contents

| File | Purpose |
|---|---|
| `PHASE_6C_REPORT.md` | The Phase 6C validation report (15 sections + acceptance matrix) |
| `calibration-log.md` | Per-sensor calibration records (real entries only) |
| `validation-session-template.md` | Blank `VAL-YYYYMMDD-###` session sheet — copy per session |
| `sensor-reference-table.md` | Sensor models, ranges, warm-up basis, reference instruments needed |
| `stability-analysis.py` | Offline min/max/mean/std calculator for captured vector series |

## Workflow

1. Copy `validation-session-template.md` → `sessions/VAL-YYYYMMDD-###.md` (git-ignored working copies; only completed, reviewed sessions are committed).
2. Set `VALIDATION_SESSION_ID` in ESP32 `config.h` to the session ID.
3. Power the rig, capture the boot validation screen, run warm-up.
4. Calibrate pH/DO/EC against reference solutions; record in `calibration-log.md`.
5. Capture reference comparisons per sensor; log raw values, never adjusted ones.
6. Run the 30–60 min stability capture; analyze with `stability-analysis.py`.
7. Normal-water test via DeepSee; record vector + ML result + counts.
8. Summarize in `PHASE_6C_REPORT.md` with honest per-section statuses.

## Rules

- No secrets in any committed file (device keys, Wi-Fi passwords).
- No `PASS` without an observed session ID.
- Test-mode (`hardware_test`) rows are bench data, never physical evidence.
- Do not relabel historical `source = NULL` rows.
