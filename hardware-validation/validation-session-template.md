# Validation Session Sheet — VAL-YYYYMMDD-###

> Copy this template per session. One session = one continuous powered run.
> Fill every field from observation. Leave `NOT PERFORMED` where applicable.

## Session

| Field | Value |
|---|---|
| Session ID | `VAL-YYYYMMDD-###` |
| Date / time (local + UTC) | |
| Operator | |
| Device ID | `esp32_001` |
| Firmware version | |
| ESP32 board (exact model) | |
| Location / bench description | |
| Water sample description | |

## 1. Electrical / discovery (Layer A)

Paste the boot validation screen serial output:

```text
(paste here)
```

| Check | Result | Notes |
|---|---|---|
| ESP32 supply voltage (measured) | V | |
| Sensor rail voltage (measured) | V | |
| I²C SDA/SCL pull-ups present | YES / NO | |
| EZO-DO 0x61 | DETECTED / NOT DETECTED / ERROR | |
| EZO-pH 0x63 | DETECTED / NOT DETECTED / ERROR | |
| EZO-EC 0x64 | DETECTED / NOT DETECTED / ERROR | |
| DS18B20 GPIO4 | DETECTED / NOT DETECTED / ERROR | |
| Turbidity divider R_TOP (measured Ω) | | |
| Turbidity divider R_BOT (measured Ω) | | |
| GPIO34 max observed (V) | | must stay ≤ 3.0 V |
| Ground continuity | YES / NO | |
| Discovery verdict | PASS / PARTIAL / FAIL | |

## 2. Warm-up

| Sensor | Warm-up observed | Ready at (uptime) |
|---|---|---|
| DS18B20 | | |
| EZO-pH | | |
| EZO-DO | | |
| EZO-EC | | |
| SEN0189 | | |

## 3. Calibration (Layer B)

| Sensor | Method | Points / solutions | Temp | Result | Session time |
|---|---|---|---|---|---|
| pH | | | | | |
| DO | | | | | |
| EC | | | | | |
| Turbidity trim | | | | | |

(Copy rows into `calibration-log.md` after the session.)

## 4. Reference comparisons (Layer C)

### Temperature (reference thermometer: make/model/accuracy)

| # | Reference °C | DS18B20 °C | |Δ| °C | Time |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### pH (reference solutions)

| Solution (nominal) | Reference | Measured | Δ | Temp | Time |
|---|---|---|---|---|---|
| | | | | | |

### Dissolved oxygen

| Condition | Temp | Salinity in | Pressure source | Measured mg/L | Time |
|---|---|---|---|---|---|
| | | | not_measured / configured | | |

### Salinity / EC

| Reference | Temp | Raw EC (diag) | Salinity PSU | Δ | Time |
|---|---|---|---|---|---|

### Turbidity (reference conditions, NOT lab NTU unless calibrated rig exists)

| Condition | ADC raw | Voltage | Converted NTU | Trim applied | Time |
|---|---|---|---|---|---|
| clear/low | | | | | |
| medium | | | | | |
| higher | | | | | |

## 5. Stability run (Layer C/D)

| Field | Value |
|---|---|
| Duration | min |
| Vectors captured | |
| Invalid vectors | |
| ESP32 resets | |
| Wi-Fi reconnects | |
| HTTP failures | |
| I²C errors | |
| mlReady transitions | |

Attach `stability-analysis.py` output (min/max/mean/std per feature — reported
as **observed variation**, not sensor error).

## 6. DeepSee integration (Layer D)

| Check | Value |
|---|---|
| Vector received (backend timestamp) | |
| `mlReady` | true / false |
| `source` / `deviceId` in DB | |
| System Intelligence 5/5 + ML READY | YES / NO |
| Validation session shown in UI | YES / NO |

## 7. Normal-water test (§19)

| Vector (5 values) | Timestamp | ML result | Alerts before/after | Inspections before/after |
|---|---|---|---|---|
| | | anomaly / normal | / | / |

## 8. Notes / failures

Record every anomaly honestly — resets, dropouts, rejected readings, retry
storms. A failure recorded is a successful validation activity.
