import csv
import random
import datetime

# Configuration
NUM_SAMPLES = 5000
OUTPUT_FILE = "ocean_sensor_data.csv"

# Normal ranges for deep sea water (approximate)
NORMAL_TEMP_RANGE = (2.0, 4.0) # Celsius
NORMAL_PH_RANGE = (7.8, 8.1)
NORMAL_SALINITY = (34.0, 35.0) # PSU
NORMAL_OXYGEN = (4.0, 6.0) # mg/L
NORMAL_TURBIDITY = (0.1, 1.0) # NTU

print("Generating Synthetic Ocean Sensor Dataset...")

def generate_normal_reading(timestamp):
    return {
        "timestamp": timestamp.isoformat(),
        "temperature": round(random.uniform(*NORMAL_TEMP_RANGE), 2),
        "ph": round(random.uniform(*NORMAL_PH_RANGE), 2),
        "salinity": round(random.uniform(*NORMAL_SALINITY), 2),
        "oxygen": round(random.uniform(*NORMAL_OXYGEN), 2),
        "turbidity": round(random.uniform(*NORMAL_TURBIDITY), 2),
        "is_anomaly": 0,
        "anomaly_type": "None"
    }

def generate_anomaly(timestamp):
    anomaly_type = random.choice(["Chemical Leak", "Thermal Plume"])
    if anomaly_type == "Chemical Leak":
        return {
            "timestamp": timestamp.isoformat(),
            "temperature": round(random.uniform(*NORMAL_TEMP_RANGE), 2),
            "ph": round(random.uniform(6.0, 7.2), 2), # Acidic drop
            "salinity": round(random.uniform(*NORMAL_SALINITY), 2),
            "oxygen": round(random.uniform(1.0, 3.0), 2), # Oxygen depleted
            "turbidity": round(random.uniform(5.0, 15.0), 2), # Very cloudy
            "is_anomaly": 1,
            "anomaly_type": anomaly_type
        }
    else: # Thermal Plume
        return {
            "timestamp": timestamp.isoformat(),
            "temperature": round(random.uniform(8.0, 15.0), 2), # Sudden heat
            "ph": round(random.uniform(*NORMAL_PH_RANGE), 2),
            "salinity": round(random.uniform(*NORMAL_SALINITY), 2),
            "oxygen": round(random.uniform(*NORMAL_OXYGEN), 2),
            "turbidity": round(random.uniform(*NORMAL_TURBIDITY), 2),
            "is_anomaly": 1,
            "anomaly_type": anomaly_type
        }

# Generate Data
data = []
start_time = datetime.datetime.now() - datetime.timedelta(days=30)

for i in range(NUM_SAMPLES):
    current_time = start_time + datetime.timedelta(minutes=10 * i)
    if random.random() < 0.95:
        data.append(generate_normal_reading(current_time))
    else:
        data.append(generate_anomaly(current_time))

# Save to CSV
with open(OUTPUT_FILE, mode='w', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=["timestamp", "temperature", "ph", "salinity", "oxygen", "turbidity", "is_anomaly", "anomaly_type"])
    writer.writeheader()
    writer.writerows(data)

print(f"Generated {NUM_SAMPLES} readings and saved to {OUTPUT_FILE}")
print(f"Normal Readings: {sum(1 for d in data if d['is_anomaly'] == 0)}")
print(f"Anomalies (Pollution Events): {sum(1 for d in data if d['is_anomaly'] == 1)}")
