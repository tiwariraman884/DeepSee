"""
DeepSea Live Data Simulator — v2 (Pipeline-Connected)
=======================================================
Ye script MQTT sensor behavior simulate karta hai.

Pehle: Direct SQLite write karta tha (database ko bypass karta tha)
Ab:    POST /api/sensors/ingest → EventBus → ML Worker → SQLite WAL → SSE

Isse poora pipeline test hota hai:
  Simulator → HTTP POST → Express → EventBus → ML (RAM) → SQLite → SSE → Dashboard

- Every 3 seconds ek sensor reading generate hoti hai
- 5% chance of anomaly injection (chemical spill simulation)
- Agar backend down ho toh gracefully direct DB fallback karta hai
"""
import sqlite3
import json
import time
import random
import datetime
import sys
import urllib.request
import urllib.error

# ─── Config ────────────────────────────────────────────────────────────────────
DB_PATH      = r"backend\.data\deepsea.db"
INGEST_URL   = "http://localhost:5000/api/sensors/ingest"
TICK_INTERVAL = 15     # seconds between readings
ANOMALY_CHANCE = 0.05  # 5% chance per tick

# ─── Helpers ───────────────────────────────────────────────────────────────────
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def drift(val, spread, lo, hi):
    return round(max(lo, min(hi, val + random.uniform(-spread, spread))), 2)

def post_to_pipeline(payload: dict) -> bool:
    """POST sensor reading to EventBus pipeline via HTTP."""
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            INGEST_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            return resp.status == 202
    except Exception:
        return False

def write_direct_db(sensor_id: str, reading: dict, now: str):
    """Fallback: write directly to SQLite if backend is down."""
    try:
        conn = get_conn()
        conn.execute(
            "UPDATE sensors SET last_reading_json=?, updated_at=? WHERE id=?",
            (json.dumps(reading), now, sensor_id)
        )
        conn.execute(
            "INSERT INTO sensor_readings (sensor_id, ph, temp, salinity, oxygen, turbidity, recorded_at) VALUES (?,?,?,?,?,?,?)",
            (sensor_id, reading.get("ph"), reading.get("temp"),
             reading.get("salinity"), reading.get("oxygen"), reading.get("turbidity"), now)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        pass

# ─── Startup ────────────────────────────────────────────────────────────────────
print("=" * 60)
print(" DeepSea Live Sensor Simulator v2 — Pipeline Mode")
print("=" * 60)
print(f"  Endpoint : {INGEST_URL}")
print(f"  Interval : {TICK_INTERVAL}s | Anomaly chance: {ANOMALY_CHANCE*100:.0f}%")
print(f"  Pipeline : Simulator -> HTTP -> EventBus -> ML(RAM) -> SQLite -> SSE")
print("=" * 60)

# Test if backend is reachable
try:
    urllib.request.urlopen("http://localhost:5000/api/health", timeout=3)
    pipeline_mode = True
    print("  ✅ Backend reachable — using PIPELINE mode (full stack)")
except Exception:
    pipeline_mode = False
    print("  ⚠️  Backend offline — using DIRECT DB fallback mode")
print()

# ─── Main simulation loop ───────────────────────────────────────────────────────
tick = 0
pipeline_ok_count = 0
pipeline_fail_count = 0

while True:
    try:
        conn = get_conn()
        sensors = conn.execute("SELECT id, name, last_reading_json FROM sensors WHERE online=1").fetchall()
        conn.close()
        now = datetime.datetime.utcnow().isoformat() + "Z"

        for s in sensors:
            try:
                reading = json.loads(s["last_reading_json"]) if s["last_reading_json"] else {}
            except Exception:
                reading = {}

            # Base values from last reading
            temp      = reading.get("temp", 3.0)
            ph        = reading.get("ph", 8.0)
            salinity  = reading.get("salinity", 34.5)
            oxygen    = reading.get("oxygen", 5.0)
            turbidity = reading.get("turbidity", 0.5)

            # Inject anomaly?
            is_anomaly = random.random() < ANOMALY_CHANCE

            if is_anomaly:
                # Chemical spill signature
                new_ph        = round(random.uniform(6.0, 7.0), 2)
                new_oxygen    = round(random.uniform(1.0, 3.0), 2)
                new_turbidity = round(random.uniform(6.0, 15.0), 2)
                new_temp      = drift(temp, 0.1, 2.0, 4.5)
                new_salinity  = drift(salinity, 0.05, 34.0, 35.0)
                label = "🚨 ANOMALY"
            else:
                new_temp      = drift(temp, 0.15, 2.0, 4.5)
                new_ph        = drift(ph, 0.03, 7.8, 8.1)
                new_salinity  = drift(salinity, 0.05, 34.0, 35.0)
                new_oxygen    = drift(oxygen, 0.1, 4.0, 6.0)
                new_turbidity = drift(turbidity, 0.05, 0.1, 1.0)
                label = "  normal"

            new_reading = {
                "temp": new_temp, "ph": new_ph,
                "salinity": new_salinity, "oxygen": new_oxygen,
                "turbidity": new_turbidity
            }

            # ── Route through EventBus pipeline (primary) ──────────────────
            payload = {
                "sensorId":    s["id"],
                "sensorName":  s["name"],
                "temperature": new_temp,
                "ph":          new_ph,
                "salinity":    new_salinity,
                "oxygen":      new_oxygen,
                "turbidity":   new_turbidity,
            }

            sent = post_to_pipeline(payload)

            if sent:
                pipeline_ok_count += 1
                mode_tag = "→ pipeline"
            else:
                # Fallback: direct DB write
                write_direct_db(s["id"], new_reading, now)
                pipeline_fail_count += 1
                mode_tag = "→ db-direct"

            if is_anomaly:
                print(f"  [T={tick:04d}] {label} | {s['name'][:20]:20s} | pH={new_ph:.2f} O2={new_oxygen:.2f} Turb={new_turbidity:.1f} | {mode_tag}")

        tick += 1
        sys.stdout.flush()

        # Print stats every 20 ticks
        if tick % 20 == 0:
            total = pipeline_ok_count + pipeline_fail_count
            pct = (pipeline_ok_count / total * 100) if total > 0 else 0
            print(f"\n  [STATS T={tick}] Pipeline: {pipeline_ok_count}/{total} ({pct:.0f}%) | Fallback: {pipeline_fail_count}\n")

        time.sleep(TICK_INTERVAL)

    except KeyboardInterrupt:
        print(f"\n\nSimulator stopped at tick {tick}.")
        print(f"Pipeline: {pipeline_ok_count} ok, {pipeline_fail_count} fallback")
        break
    except Exception as e:
        print(f"  Error at tick {tick}: {e}")
        time.sleep(TICK_INTERVAL)
