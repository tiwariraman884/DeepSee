"""
Phase 1: Retrain anomaly model using BOTH synthetic + real SF Beaches data.
The SF dataset has E.Coli / ENTERO bacteria counts. High bacteria = polluted = anomaly.
We derive sensor-like features from this and merge with synthetic data.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import joblib, warnings, os
warnings.filterwarnings("ignore")

base_dir = os.path.dirname(__file__)
SF_PATH = r"C:\Users\Lenovo\.cache\kagglehub\datasets\jboysen\sf-beaches-water\versions\1\beach.csv"
SYNTH_PATH = os.path.join(base_dir, "ocean_sensor_data.csv")
MODEL_OUT  = os.path.join(base_dir, "anomaly_model.pkl")

print("Phase 1: Loading datasets...")

# ── Load synthetic data ───────────────────────────────────────────────────────
synth = pd.read_csv(SYNTH_PATH)
features = ["temperature", "ph", "salinity", "oxygen", "turbidity"]
X_synth  = synth[features]

# ── Load real SF Beaches data ─────────────────────────────────────────────────
sf_raw = pd.read_csv(SF_PATH)
# Filter only numeric rows (some are '<10', replace with 5)
sf_raw["DATA"] = pd.to_numeric(sf_raw["DATA"].astype(str).str.replace("<", ""), errors="coerce")
sf_raw = sf_raw.dropna(subset=["DATA"])

# Pivot: one row per (SAMPLE_DATE, SOURCE) with columns per ANALYTE
sf_pivot = sf_raw.pivot_table(index=["SAMPLE_DATE", "SOURCE"], columns="ANALYTE", values="DATA", aggfunc="mean").reset_index()
sf_pivot.columns.name = None

# Keep only rows that have E-Coli data
ecoli_col = [c for c in sf_pivot.columns if "COLI_E" in c]
if ecoli_col:
    sf_pivot = sf_pivot.dropna(subset=ecoli_col)
    ecoli = sf_pivot[ecoli_col[0]]
else:
    ecoli = pd.Series([0]*len(sf_pivot))

# Map bacteria counts → sensor-like features
# High E.Coli bacteria → low oxygen, low pH, high turbidity (pollution markers)
n = len(sf_pivot)
rng = np.random.default_rng(42)

# Normalize E.Coli 0-1
ecoli_norm = (ecoli - ecoli.min()) / (ecoli.max() - ecoli.min() + 1e-9)

# Generate correlated sensor features
X_real = pd.DataFrame({
    "temperature": rng.uniform(2.0, 4.0, n),
    "ph":          8.1 - (ecoli_norm * 1.8),           # high bacteria → lower pH
    "salinity":    rng.uniform(34.0, 35.0, n),
    "oxygen":      6.0 - (ecoli_norm * 4.0),            # high bacteria → less oxygen
    "turbidity":   0.5 + (ecoli_norm * 12.0),           # high bacteria → more turbidity
})
X_real = X_real.clip(lower=0)

print(f"  Synthetic samples: {len(X_synth)}")
print(f"  Real SF Beaches samples (derived): {len(X_real)}")

# ── Combine & train ───────────────────────────────────────────────────────────
X_combined = pd.concat([X_synth, X_real[features]], ignore_index=True)
print(f"  Total training samples: {len(X_combined)}")

model = IsolationForest(n_estimators=150, contamination=0.05, random_state=42)
model.fit(X_combined)
joblib.dump(model, MODEL_OUT)
print(f"Model retrained and saved to '{MODEL_OUT}'")

# ── Quick validation ──────────────────────────────────────────────────────────
normal = pd.DataFrame([[3.1, 8.05, 34.5, 5.2, 0.4]], columns=features)
spill  = pd.DataFrame([[3.1, 6.5,  34.5, 2.1, 12.0]], columns=features)
print(f"  Validation - Clean water: {'Normal' if model.predict(normal)[0]==1 else 'Anomaly'}")
print(f"  Validation - Chemical spill: {'Anomaly' if model.predict(spill)[0]==-1 else 'Normal'}")
print("Phase 1 COMPLETE.")
