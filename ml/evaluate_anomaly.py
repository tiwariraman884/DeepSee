"""
Anomaly Model Evaluation — honest, reproducible metrics.
=========================================================
The Isolation Forest is UNSUPERVISED: it was trained without ground-truth
labels, so no true validation metrics exist. This script therefore reports
SYNTHETIC VALIDATION metrics only:

  - The "normal" class is sampled from the real training distribution
    (ocean_sensor_data.csv, raw sensor rows).
  - The "anomaly" class is a clearly-labelled synthetic pollution family
    (chemical spill / turbidity event / oxygen depletion / acidification),
    constructed to represent the incidents the platform is designed to catch.

These numbers measure how well the model separates the normal training
distribution from extreme pollution profiles. They do NOT measure real-world
deployment performance and must not be presented as such.

Usage:  python evaluate_anomaly.py
Output: printed report (precision / recall / F1 / FPR / FNR / confusion matrix)
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib

FEATURES = ["temperature", "ph", "salinity", "oxygen", "turbidity"]
RNG = np.random.default_rng(42)


def load_normal_distribution():
    df = pd.read_csv("ocean_sensor_data.csv")
    X = df[FEATURES].dropna()
    # Exclude the extreme tail from the "normal" sample so the anomaly class is
    # not merely "the same distribution, further out" — this keeps the classes
    # meaningfully distinct for validation purposes.
    q_hi = X.quantile(0.995)
    X = X[(X <= q_hi + 1e-9).all(axis=1)]
    return X


def synthetic_anomalies(n):
    """Labelled pollution profiles the response workflow is designed to catch."""
    base = load_normal_distribution().median()
    rows = []
    for _ in range(n):
        kind = RNG.integers(0, 4)
        r = base.copy()
        if kind == 0:      # chemical spill: acidic, oxygen-poor, turbid
            r["ph"] = RNG.uniform(5.5, 7.0)
            r["oxygen"] = RNG.uniform(1.0, 3.0)
            r["turbidity"] = RNG.uniform(8.0, 25.0)
        elif kind == 1:    # sediment/turbidity event
            r["turbidity"] = RNG.uniform(10.0, 40.0)
            r["oxygen"] = RNG.uniform(2.0, 4.0)
        elif kind == 2:    # oxygen depletion (dead zone)
            r["oxygen"] = RNG.uniform(0.2, 1.8)
        else:              # strong acidification
            r["ph"] = RNG.uniform(4.5, 6.5)
        rows.append(r[FEATURES])
    return pd.DataFrame(rows, columns=FEATURES)


def main():
    model = joblib.load("anomaly_model.pkl")
    normal = load_normal_distribution().sample(n=2000, random_state=42)
    anomalies = synthetic_anomalies(500)

    X = pd.concat([normal, anomalies], ignore_index=True)
    y = np.array([0] * len(normal) + [1] * len(anomalies))  # 1 = anomaly

    pred = (model.predict(X) == -1).astype(int)  # model: -1 = anomaly

    tp = int(((pred == 1) & (y == 1)).sum())
    tn = int(((pred == 0) & (y == 0)).sum())
    fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    fnr = fn / (fn + tp) if (fn + tp) else 0.0

    print("=" * 62)
    print("ANOMALY MODEL — SYNTHETIC VALIDATION REPORT (NOT production metrics)")
    print("=" * 62)
    print(f"Model                 : Isolation Forest (unsupervised, no labels at train time)")
    print(f"Normal class          : {len(normal)} rows sampled from ocean_sensor_data.csv")
    print(f"Anomaly class         : {len(anomalies)} synthetic labelled pollution profiles")
    print("-" * 62)
    print(f"Precision             : {precision:.3f}")
    print(f"Recall                : {recall:.3f}")
    print(f"F1 score              : {f1:.3f}")
    print(f"False Positive Rate   : {fpr:.3f}")
    print(f"False Negative Rate   : {fnr:.3f}")
    print("-" * 62)
    print("Confusion matrix (rows = truth normal/anomaly, cols = predicted):")
    print(f"                      predicted-normal   predicted-anomaly")
    print(f"  actual normal    {tn:>12d} {fp:>19d}")
    print(f"  actual anomaly   {fn:>12d} {tp:>19d}")
    print("-" * 62)
    print("LIMITATIONS: unsupervised model, synthetic anomaly family, single")
    print("sensor-station dataset. Real-world performance is not measured here.")
    print("The /api/sensors/predict behaviour should be treated as AI-assisted")
    print("screening with simulated demo values, not a validated deployment.")


if __name__ == "__main__":
    main()
