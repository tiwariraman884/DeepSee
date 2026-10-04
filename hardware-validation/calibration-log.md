# Calibration Log — ESP32 `esp32_001` (firmware 0.2.x)

> Real entries only. Each entry must reference a validation session.
> **Current status: NO PHYSICAL CALIBRATION PERFORMED** — the table below
> holds the procedure; rows are added only after observed sessions.

## pH (EZO-pH + probe)

| Date | Session | Points (7 / 4 / 10) | Temp °C | Result | Operator | Notes |
|---|---|---|---|---|---|---|
| — | — | NOT PERFORMED | — | — | — | — |

Procedure: `CAL PH MID 7` → `CAL PH LOW 4` → `CAL PH HIGH 10` over serial
(1/2/3-point per Atlas workflow). Verify with `Cal,?` (expect `?CAL,3`).

## Dissolved oxygen (EZO-DO + galvanic probe)

| Date | Session | Mode (air / zero) | Temp °C | Salinity in | Pressure source | Result | Operator |
|---|---|---|---|---|---|---|---|
| — | — | NOT PERFORMED | — | — | not_measured | — | — |

Procedure: `CAL DO` (air, dripping-wet membrane) and/or `CAL DO ZERO`
(zero-O₂ solution). Pressure stays `not_measured` unless a configured
default is explicitly set.

## Salinity / EC (EZO-EC + probe, K = ___)

| Date | Session | Points (dry / low / high) | Reference µS | Temp °C | Result | Operator |
|---|---|---|---|---|---|---|
| — | — | NOT PERFORMED | — | — | — | — |

Probe K value on hand: ___ (K0.1 → 84/1413 µS · K1.0 → 12880/80000 µS · K10 → 12880/150000 µS).
Payload must always be SALINITY (PSU), never raw EC.

## Turbidity (SEN0189 + divider, NVS trim)

| Date | Session | Slope | Offset | Reference conditions | Result | Operator |
|---|---|---|---|---|---|---|
| — | — | NOT PERFORMED (factory curve) | — | — | — | — |

Procedure: `TURB CAL <slope> <offset>` against known NTU standards.
Untrimmed = `CALIBRATION_REQUIRED` in diagnostics (honest by design).

## Temperature (DS18B20)

Factory-set (Maxim ±0.5 °C per datasheet — the limit of what the setup can
claim without a reference comparison). Field verification against a reference
thermometer is recorded in session sheets, not here.
