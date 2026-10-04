# DeepSee Phase 6C — Physical Hardware Validation Report

> **Validation rule:** nothing below is reported as physically successful
> unless physically observed. Software integration tests prove software
> behavior only. Date: 2026-09-28. Firmware: 0.2.0 (source only, uncompiled).

## 1. Hardware configuration — SOFTWARE VERIFIED (inventory, not connection)

| Item | Expected | Physically connected |
|---|---|---|
| ESP32 DevKit V1 (`esp32_001`) | bench unit | NOT PERFORMED (no hardware available) |
| DS18B20 probe, GPIO4 | 1-Wire | NOT PERFORMED |
| EZO-pH circuit + probe, 0x63 | I²C | NOT PERFORMED |
| EZO-DO circuit + probe, 0x61 | I²C | NOT PERFORMED |
| EZO-EC circuit + probe, 0x64 | I²C | NOT PERFORMED |
| SEN0189 + 20k/39k divider → GPIO34 | ADC1 | NOT PERFORMED |

## 2. Firmware version — SOFTWARE VERIFIED

`FIRMWARE_VERSION 0.2.0`. Validation-session plumbing (`VALIDATION_SESSION_ID`),
`Cal,?` calibration-state queries, NVS turbidity-trim flag, plausibility
guards, structured boot screen, and diagnostics `calibration` map are
implemented in source. **Compilation NOT PERFORMED (no PlatformIO toolchain;
pip blocked by policy). Flashing NOT PERFORMED.**

## 3. Wiring verification — NOT PERFORMED

Pin map, divider design (4.5 V → ~2.97 V), and pull-up requirements are
documented in `hardware/esp32/README.md` and `sensor-reference-table.md`.
No bench meter readings exist. Installed `R1`/`R2` values: **unrecorded**.

## 4. Device discovery — SOFTWARE VERIFIED (protocol logic)

Boot scan + `[1/5]…[5/5]` self-test screen + PASS/PARTIAL/FAIL verdict are
implemented. No physical boot log exists. I²C addresses (0x61/0x63/0x64),
GPIO4 reservation, and ADC1 selection are code-reviewed only.

## 5. Calibration records — NOT PERFORMED

`calibration-log.md` holds procedures with empty tables. No pH/DO/EC/turbidity
calibration has been executed; no `CALIBRATED` state has ever been reported
by a device. DS18B20 remains factory-set by design.

## 6. Temperature validation — NOT PERFORMED

No reference thermometer comparison exists.

## 7. pH validation — NOT PERFORMED

No buffer solutions, no calibration points, no post-cal readings.

## 8. DO validation — NOT PERFORMED

No air/zero calibration; pressure remains `not_measured` everywhere it appears.

## 9. Salinity validation — NOT PERFORMED

No conductivity standards; PSU path (field index 2) is code-reviewed only.

## 10. Turbidity validation — NOT PERFORMED

Divider math and median sampling are code-reviewed only. Conversion remains
`measurement_class = prototype_estimate`; UI never claims lab NTU.

## 11. Long-run stability — NOT PERFORMED

No 30–60 min powered run. Firmware records resets/reconnects/failures to
serial; `stability-analysis.py` is tool-tested on 35 synthetic vectors only
(self-test, not physical data).

## 12. Normal-water test — SOFTWARE VERIFIED (contract only)

Backend integration tests prove a complete, schema-valid vector yields
`mlReady=true` with no false dispatch for normal values, and temp-only input
never reaches the model. No physical water sample has been measured.

## 13. DeepSee integration — SOFTWARE VERIFIED

- Complete hardware(-contract) vector → 202, `source=hardware`, `mlReady=true`
  → anomaly → dispatch → inspection → evidence → incident report (tested).
- `hardware_test` vectors persist distinctly and never surface as hardware.
- Intelligence shows 5/5 + ML READY for complete vectors; diagnostics
  (firmware/session/RSSI/calibration/pressure) round-trip tested.
- No physical 5-feature vector has ever reached the backend.

## 14. Known limitations

1. No ESP32, sensors, PlatformIO, or bench equipment available here.
2. Turbidity NTU is prototype-estimate until trimmed against standards.
3. DO pressure compensation defaults to not-measured.
4. Buffered offline readings carry backend receipt timestamps (documented).
5. Live dev simulator rows (`source=NULL`) exist for `esp32_001` in the shared
   DB; hardware surfaces prefer `source='hardware'` and never relabel history.
6. BENCH / CONTROLLED WATER scope only — no IP68, pressure, saltwater, or
   deep-sea claim of any kind.

## 15. Validation conclusion

Phase 6C **software and documentation are complete**; **physical validation
is NOT PERFORMED** on any layer (A–D). The system correctly reports this:
firmware defaults to `CALIBRATION_REQUIRED`/`MISSING`, the UI shows
calibration states only as reported, and no `CALIBRATED` badge can appear
without a device actually reporting calibration.

## Acceptance matrix (§33)

| Test | Software Verified | Physical Verified | Result |
|---|---|---|---|
| ESP32 boot | ✓ (boot screen logic) | ✗ | NOT PERFORMED |
| DS18B20 reading | ✓ (adapter + gate tests) | ✗ | NOT PERFORMED |
| pH calibration | ✓ (`Cal,?` + menu + API) | ✗ | NOT PERFORMED |
| DO calibration | ✓ (same) | ✗ | NOT PERFORMED |
| EC/salinity calibration | ✓ (same) | ✗ | NOT PERFORMED |
| Turbidity validation | ✓ (validation logic) | ✗ | NOT PERFORMED |
| 5-feature vector | ✓ (contract + gate tests) | ✗ | NOT PERFORMED |
| ML ready | ✓ (mlReady gate tests) | ✗ | NOT PERFORMED |
| Normal water | ✓ (no-false-dispatch test) | ✗ | NOT PERFORMED |
| Hardware anomaly | ✓ (full pipeline test) | ✗ | NOT PERFORMED |
| Long-run stability | ✓ (buffer/retry logic) | ✗ | NOT PERFORMED |
| Incident provenance | ✓ (dataSource tests) | ✗ | NOT PERFORMED |

**Deployment claim: NONE.** Not bench-validated, not field-deployed, not
deep-sea ready. The only supportable statement is: *validation-capable
firmware and traceable software pipeline implemented; physical validation
pending hardware availability.*
