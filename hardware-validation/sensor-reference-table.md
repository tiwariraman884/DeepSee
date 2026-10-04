# Sensor Reference Table — Phase 6B rig (`esp32_001`, firmware 0.2.x)

## Devices

| Role | Model | Interface | Address / Pin | Notes |
|---|---|---|---|---|
| MCU | ESP32 DevKit V1 (ESP32-WROOM-32) | — | — | bench unit, no enclosure rating |
| Temperature | Maxim DS18B20 waterproof probe | 1-Wire | GPIO4, 4.7 kΩ → 3V3 | factory-set, ±0.5 °C per datasheet |
| pH circuit | Atlas Scientific EZO-pH | I²C | **0x63** | circuit only — matched pH probe required separately |
| DO circuit | Atlas Scientific EZO-DO | I²C | **0x61** | circuit only — galvanic DO probe + membrane cap required separately |
| EC circuit | Atlas Scientific EZO-EC | I²C | **0x64** | circuit only — EC probe with known K (0.1/1.0/10) required separately |
| Turbidity | DFRobot SEN0189 (TSW-20M) | analog 0–4.5 V | divider → **GPIO34 (ADC1)** | 5 V supply; conditioned, never direct |

## Backend schema ranges (validation must stay inside these)

| Feature | Range | Unit |
|---|---|---|
| temperature | −5 … 50 | °C |
| pH | 0 … 14 | — |
| salinity | 0 … 50 | PSU |
| oxygen | 0 … 20 | mg/L |
| turbidity | 0 … 1000 | NTU |

## Warm-up basis (documented response characteristics)

| Sensor | Basis | Firmware window |
|---|---|---|
| DS18B20 | 750 ms max conversion (datasheet) | covered by 5 s |
| EZO-pH/DO/EC | ~0.3–1 s command response (Atlas docs) | covered by 5 s + staggered reads |
| SEN0189 | analog settle + 16-sample median | covered by 5 s |

Firmware `SENSOR_WARMUP_MS = 5000` is a conservative envelope over these, not
a manufacturer universal figure.

## Reference instruments / materials needed (not yet procured — see report)

| Sensor | Reference needed |
|---|---|
| DS18B20 | calibrated reference thermometer (±0.1 °C or better) |
| pH | pH 4.00 / 7.00 / 10.00 buffer solutions + rinse water |
| DO | zero-O₂ solution (sodium sulfite) + air-saturation setup |
| EC | conductivity standards matched to probe K |
| Turbidity | Formazin or calibrated NTU standards (3 points minimum) |
| Electrical | multimeter (rails, divider, continuity), USB current check |

## Turbidity conditioning (as designed — verify on bench before trusting)

```text
SEN0189 SIG (0–4.5 V) → R_TOP 20 kΩ → GPIO34 → R_BOT 39 kΩ → GND
4.5 V × 39/(20+39) ≈ 2.97 V max at ADC (11 dB, 12-bit)
```

Record the actually installed resistor values + measured max in the session
sheet. Re-measure after any rewiring.
