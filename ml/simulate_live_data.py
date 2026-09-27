"""
Phase 2: Live Data Simulation
Runs continuously, updates sensor readings in DB every 5 seconds.
3% chance of injecting a sudden anomaly (chemical spill).
"""
import sqlite3, json, time, random, datetime, math, sys

DB_PATH = r"..\\.data\\deepsea.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def drift(val, spread, lo, hi):
    return round(max(lo, min(hi, val + random.uniform(-spread, spread))), 2)

print("Phase 2: Live Data Simulator started (Ctrl+C to stop)")
print(f"  Database: {DB_PATH}")
print("  Updating every 5 seconds. 3% chance of anomaly injection.")

tick = 0
while True:
    try:
        conn = get_conn()
        sensors = conn.execute("SELECT id, last_reading_json FROM sensors WHERE online=1").fetchall()
        now = datetime.datetime.utcnow().isoformat()

        for s in sensors:
            try:
                reading = json.loads(s["last_reading_json"]) if s["last_reading_json"] else {}
            except Exception:
                reading = {}

            # Base values
            temp     = reading.get("temp", 3.0)
            ph       = reading.get("ph", 8.0)
            salinity = reading.get("salinity", 34.5)
            oxygen   = reading.get("oxygen", 5.0)
            turbidity= reading.get("turbidity", 0.5)

            # 3% chance of anomaly injection
            is_anomaly = random.random() < 0.03

            if is_anomaly:
                # Sudden chemical spill signature
                new_ph       = round(random.uniform(6.0, 7.0), 2)
                new_oxygen   = round(random.uniform(1.0, 3.0), 2)
                new_turbidity= round(random.uniform(6.0, 15.0), 2)
                new_temp     = drift(temp, 0.1, 2.0, 4.5)
                new_salinity = drift(salinity, 0.05, 34.0, 35.0)
                label = "ANOMALY"
            else:
                new_temp     = drift(temp, 0.15, 2.0, 4.5)
                new_ph       = drift(ph, 0.03, 7.8, 8.1)
                new_salinity = drift(salinity, 0.05, 34.0, 35.0)
                new_oxygen   = drift(oxygen, 0.1, 4.0, 6.0)
                new_turbidity= drift(turbidity, 0.05, 0.1, 1.0)
                label = "normal"

            new_reading = {
                "temp": new_temp, "ph": new_ph,
                "salinity": new_salinity, "oxygen": new_oxygen,
                "turbidity": new_turbidity
            }

            # Update sensor last_reading_json
            conn.execute(
                "UPDATE sensors SET last_reading_json=?, updated_at=? WHERE id=?",
                (json.dumps(new_reading), now, s["id"])
            )
            # Insert into sensor_readings time-series
            conn.execute(
                "INSERT INTO sensor_readings (sensor_id, ph, temp, salinity, oxygen, turbidity, recorded_at) VALUES (?,?,?,?,?,?,?)",
                (s["id"], new_ph, new_temp, new_salinity, new_oxygen, new_turbidity, now)
            )

            if is_anomaly:
                print(f"  [TICK {tick}] ANOMALY injected into sensor {s['id'][:8]}... | pH={new_ph} O2={new_oxygen} Turbidity={new_turbidity}")

        conn.commit()
        conn.close()
        tick += 1
        sys.stdout.flush()
        time.sleep(5)

    except KeyboardInterrupt:
        print("\nSimulator stopped.")
        break
    except Exception as e:
        print(f"  Error: {e}")
        time.sleep(5)
