import pandas as pd
from sklearn.ensemble import IsolationForest
# pyrefly: ignore [missing-import]
import joblib

# 1. Load Data
DATA_FILE = "ocean_sensor_data.csv"
MODEL_FILE = "anomaly_model.pkl"

print(f"Loading data from {DATA_FILE}...")
df = pd.read_csv(DATA_FILE)

# 2. Select Features for Training
# We only use the raw sensor values to find anomalies
features = ["temperature", "ph", "salinity", "oxygen", "turbidity"]
X = df[features]

print(f"Training Data Shape: {X.shape}")

# 3. Initialize and Train the Model
# Isolation Forest is great for unsupervised anomaly detection
# contamination=0.05 means we expect roughly 5% of the data to be anomalies (pollution)
print("Training Isolation Forest Model (This is the 'Brain')...")
model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
model.fit(X)

# 4. Save the trained model
joblib.dump(model, MODEL_FILE)
print(f"Model trained successfully and saved to '{MODEL_FILE}'")

# --- Quick Test ---
print("\n--- Testing the Model ---")
# Normal Data (pH ~8.0, Turbidity ~0.5)
test_normal = pd.DataFrame([[3.1, 8.05, 34.5, 5.2, 0.4]], columns=features)
# Pollution Data (Chemical Leak: pH dropped to 6.5, Turbidity high 12.0)
test_pollution = pd.DataFrame([[3.1, 6.5, 34.5, 2.1, 12.0]], columns=features)

pred_normal = model.predict(test_normal)
pred_pollution = model.predict(test_pollution)

# -1 means Anomaly, 1 means Normal
print(f"Test Normal Water Output: {'Anomaly' if pred_normal[0] == -1 else 'Normal'}")
print(f"Test Chemical Spill Output: {'Anomaly' if pred_pollution[0] == -1 else 'Normal'}")
