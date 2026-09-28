"""
DeepSea ML Inference Server
============================
Ye ek long-running Python process hai jo model ko SIRF EK BAAR
RAM mein load karta hai aur phir stdin se har request ko milliseconds
mein process karta hai — bar bar model load nahi hota.

Architecture:
  Node.js → stdin (JSON line) → predict_server.py → stdout (JSON line) → Node.js

Protocol: newline-delimited JSON (NDJSON)
  Input:  {"id": "req-1", "temperature": 3.1, "ph": 6.5, "salinity": 34.5, "oxygen": 2.1, "turbidity": 12.0}
  Output: {"id": "req-1", "isAnomaly": true, "score": -0.42, "status": "success", "latency_ms": 0.8}
"""
import sys
import json
import os
import time
import signal
import joblib
import pandas as pd

# ─── Model loading (ONCE at startup, then stays in RAM) ──────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "anomaly_model.pkl")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "anomaly_scaler.pkl")

def load_model():
    """Load model into RAM. This happens once at process start."""
    model = joblib.load(MODEL_PATH)
    scaler = None
    if os.path.exists(SCALER_PATH):
        scaler = joblib.load(SCALER_PATH)
    sys.stderr.write(f"[ML-SERVER] Model loaded into RAM: {MODEL_PATH}\n")
    sys.stderr.flush()
    return model, scaler

# ─── Feature extraction ───────────────────────────────────────────────────────
FEATURE_ORDER = ["temperature", "ph", "salinity", "oxygen", "turbidity"]

def extract_features(data: dict) -> pd.DataFrame:
    """Named DataFrame matching the training schema.

    The Isolation Forest was fitted on a pandas DataFrame with these column
    names (ml/train_anomaly_detector.py). Passing an unnamed ndarray triggers
    sklearn's 'X does not have valid feature names' warning on every request
    — the input schema must be identical to the training schema.
    """
    return pd.DataFrame([[data[f] for f in FEATURE_ORDER]], columns=FEATURE_ORDER)

# ─── Prediction (in-RAM, sub-millisecond) ────────────────────────────────────
def predict(model, scaler, data: dict) -> dict:
    t0 = time.perf_counter()
    X = extract_features(data)
    if scaler is not None:
        X = scaler.transform(X)
    pred = model.predict(X)[0]           # -1 = anomaly, 1 = normal
    score = float(model.score_samples(X)[0])
    latency = round((time.perf_counter() - t0) * 1000, 3)   # ms
    return {
        "isAnomaly": bool(pred == -1),
        "score": round(score, 4),
        "status": "success",
        "latency_ms": latency
    }

# ─── Main loop (reads NDJSON from stdin, writes NDJSON to stdout) ─────────────
def main():
    sys.stderr.write("[ML-SERVER] Starting DeepSea Inference Server...\n")
    sys.stderr.flush()

    try:
        model, scaler = load_model()
    except Exception as e:
        sys.stderr.write(f"[ML-SERVER] FATAL: Could not load model: {e}\n")
        sys.stderr.flush()
        sys.exit(1)

    sys.stderr.write("[ML-SERVER] Ready. Waiting for requests on stdin...\n")
    sys.stderr.flush()

    # Signal to Node.js that we are ready
    ready_msg = json.dumps({"type": "ready", "model": os.path.basename(MODEL_PATH)})
    sys.stdout.write(ready_msg + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        req_id = None
        try:
            data = json.loads(line)
            req_id = data.get("id", "unknown")
            result = predict(model, scaler, data)
            result["id"] = req_id
            result["type"] = "prediction"
            sys.stdout.write(json.dumps(result) + "\n")
            sys.stdout.flush()
        except Exception as e:
            err = {"id": req_id, "type": "error", "status": "error", "message": str(e)}
            sys.stdout.write(json.dumps(err) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
