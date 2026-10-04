# DeepSee Guardian — ESP32 Sensor Gateway (Phase 6A + 6B)

Full 5-feature hardware telemetry into the **same production pipeline** as
simulated readings:

```text
ESP32 → Wi-Fi → POST /api/sensors/ingest → EventBus → SensorConsumer
      → (ML only with full valid vector) → alert → drone → inspection
```

> **Honesty note:** the ESP32 is physical hardware. Incomplete vectors are
> persisted and displayed but do **not** enter the ML model (`mlReady: false`).
> No values are fabricated — ever.

## Phase 6B hardware

| # | Sensor | Model | Interface | ESP32 connection |
|---|---|---|---|---|
| 1 | Temperature | DS18B20 probe | 1-Wire | **GPIO4** |
| 2 | pH | Atlas EZO-pH **circuit + pH probe** (separate parts) | I²C `0x63` | SDA **GPIO21** / SCL **GPIO22** |
| 3 | Dissolved O₂ | Atlas EZO-DO **circuit + galvanic DO probe** (separate) | I²C `0x61` | shared bus |
| 4 | Salinity | Atlas EZO-EC **circuit + EC probe** (separate; configure K below) | I²C `0x64` | shared bus |
| 5 | Turbidity | DFRobot SEN0189 (analog) | conditioned analog | **GPIO34 (ADC1)** |

Atlas circuits and probes are separate purchases — a circuit without its
matched probe measures nothing. EZO-EC probe K value (`K0.1` for low-EC /
`K1.0` general / `K10` high-EC) must match the water under test; low/high
calibration reference solutions depend on it (see table below).

Firmware layout: `src/main.cpp` (orchestration) + `src/sensors/*` (one adapter
per sensor, shared `SensorTypes.h` result contract) + `src/transport/ApiClient.h`
(authenticated POST + outcome classification).

## Power requirements

| Rail | Load |
|---|---|
| ESP32 DevKit | 5 V USB (dev) / regulated 5 V in enclosure |
| EZO circuits | 3.3–5 V (isolated supply recommended near water — see §Safety) |
| SEN0189 | **5 V only** (its output reaches ~4.5 V — see conditioning) |
| DS18B20 | 3V3, 4.7 kΩ pull-up DATA→3V3 |

## Pin map

```text
GPIO4   DS18B20 DATA (1-Wire, 4.7 kΩ → 3V3). Never I²C, never ADC.
GPIO21  I²C SDA (EZO-DO 0x61, EZO-pH 0x63, EZO-EC 0x64)
GPIO22  I²C SCL
GPIO34  Turbidity via divider (ADC1-Ch6, input-only)
```

I²C needs external 4.7 kΩ pull-ups to 3V3 if the carrier board lacks them.

## Turbidity signal conditioning (mandatory)

```text
SEN0189 SIG (0–4.5 V)
        │
       R_TOP 20 kΩ
        ├────→ GPIO34 (ADC1, 12-bit, 11 dB → ~2.97 V max)
       R_BOT 39 kΩ
        │
       GND
```

4.5 V × 39/(20+39) ≈ **2.97 V** — inside the ADC range with margin.
**Never wire SEN0189 SIG directly to an ESP32 pin.** Resistor values,
attenuation, sample count (16, median-filtered) and the NTU quadratic are
all configurable in `config.h` / `TurbiditySensor.h`.

## Firmware configuration (`src/config.h`, git-ignored)

Copy `src/config.example.h` → `src/config.h`. Key settings:

- `WIFI_SSID/PASSWORD`, `BACKEND_URL` (PC **LAN IP**, never `localhost`)
- `DEVICE_ID/DEVICE_KEY` (must match backend `ESP32_DEVICE_KEYS`)
- `SENSOR_TEST_MODE` (bench vectors + `X-Device-Mode: test` header)
- `DO_PRESSURE_COMPENSATION_ENABLED` (default **false** → `not_measured`)
- `TURB_DIV_R_TOP/BOT`, `TURB_SAMPLES`, ADC pin
- `READ_INTERVAL_MS` (12 s), retry/backoff caps, warm-up, rescan interval

## Sensor warm-up & boot sequence

```text
POWER ON → I²C scan (marks each EZO OK/MISSING) → WARM-UP (5 s)
→ validation → READY → transmit (partial vectors allowed, mlReady=false)
```

Missing circuits stay MISSING between 60 s re-scans; one bad sensor never
stops the others; nothing transmits before warm-up.

## Temperature compensation

Real DS18B20 reading is pushed to each EZO circuit (`T,<°C>`) before its
read; real EZO-EC salinity is pushed to EZO-DO (`S,<PSU>`) when available.
No hard-coded compensation temperature anywhere.

## DO salinity/pressure

- Salinity compensation: **real EZO-EC value**, skipped when EC is down.
- Pressure: **not measured** (`pressureSource: "not_measured"` in
  diagnostics) unless `DO_PRESSURE_COMPENSATION_ENABLED` + explicit
  `DO_PRESSURE_MBAR` default is configured.

## Calibration (serial menu @115200, EZO cal persists on-chip)

```text
CAL PH MID 7 | CAL PH LOW 4 | CAL PH HIGH 10 | CAL PH CLEAR   (1/2/3-point)
CAL DO            (air saturation, probe in air, dripping wet membrane)
CAL DO ZERO       (zero-O₂ solution)
CAL EC DRY        (dry probe) | CAL EC LOW <µS> | CAL EC HIGH <µS>
TURB CAL <slope> <offset>     (2-point trim, NVS-backed)
```

Reference solutions depend on EC probe K:

| Probe | Low point | High point |
|---|---|---|
| K0.1 | 84 µS | 1413 µS |
| K1.0 | 12880 µS | 80000 µS |
| K10 | 12880 µS | 150000 µS |

Turbidity: the built-in quadratic is the SEN0189 characteristic curve, not
lab accuracy — always field-trim with `TURB CAL` against known NTU standards.

## ML readiness contract

`mlReady=true` **iff** all five features are present, finite, and inside the
backend Zod ranges (temp −5..50, pH 0..14, salinity 0..50, O₂ 0..20,
turbidity 0..1000). Otherwise the payload omits invalid fields and the
backend replies `mlReady:false` + `missingFeatures`. No zero defaults, no
last-value hold.

## Diagnostics & offline behavior

- Diagnostics POST (`firmwareVersion`, uptime, RSSI, per-sensor states,
  `pressureSource`) every 5th cycle to `/api/sensors/diagnostics`.
- Wi-Fi loss: newest-first ring buffer of **5** vectors; backend receipt
  timestamps apply (no fabricated device time).
- Test mode vectors are stored server-side as `source=hardware_test`.

## Expected boot serial output

```text
DeepSea ESP32 Sensor Gateway
Firmware: 0.2.0
Device: esp32_001
I2C:
  EZO-DO  0x61  OK
  EZO-pH  0x63  OK
  EZO-EC  0x64  OK
1-Wire:
  DS18B20 OK
ADC:
  Turbidity OK
Network:
  Wi-Fi CONNECTED
ML vector:
  READY
```

## Bench-test procedure (no deployment needed)

1. Wire per pin map (dividers first — meter GPIO34 ≤ 3.0 V at full turbidity).
2. Configure `config.h`, `pio run`, flash, open monitor.
3. Confirm boot report shows all `OK` (or honest `MISSING`).
4. Run pH/EC/DO calibrations per menu; trim turbidity.
5. Watch 202s; check System Intelligence → HARDWARE TELEMETRY → 5/5, ML READY.
6. For anomaly path: use `SENSOR_TEST_MODE=false` with real acidic/low-O₂ sample,
   or validate via backend integration tests.

## Troubleshooting

| Symptom | Fix |
|---|---|
| I²C device MISSING | pull-ups? 3V3 levels? address changed via `I2C,address` previously? |
| pH reads 7.00 frozen | probe dry/failed; EZO replies still parse — replace probe, recalibrate |
| DO drifts | membrane fouled; recalibrate air/zero; check salinity comp source |
| Turbidity pinned 0/1000 | divider ratio wrong; verify GPIO34 ≤ 3.0 V; re-trim |
| HTTP 401/403 | DEVICE_ID/KEY mismatch; never retried blindly by design |
| HTTP 429 | increase READ_INTERVAL_MS |

## Safety / integrity

**BENCH / CONTROLLED WATER TEST SYSTEM.** Not IP68, not pressure-rated, not
deep-sea deployment, no saltwater long-term reliability claim. Isolate mains
power near water; prefer isolated EZO carriers; fuse the 5 V rail.

## Known limitations

- No pressure sensor → DO pressure compensation off by default.
- Turbidity is sensor-characteristic conversion, not lab NTU.
- EZO reads are sequential (~1 s each); a full cycle takes ~4–5 s worst case.
- Offline buffer holds 5 newest vectors only.

## Physical validation status

> **Physical sensor validation: not performed** — no ESP32/sensor hardware was
> available during implementation and no toolchain exists to compile the
> firmware here. Validated: payload/ML-gate/diagnostics contract via backend
> integration tests using the identical HTTP contract, plus code review of the
> adapter/validation/compensation logic.
