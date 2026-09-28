"""
Phase 3: Pollution Spread Forecast
Takes current pollution severity + location, predicts severity for next 6 hours.
Uses polynomial regression on historical pattern.
"""
import sys, json, re
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline


def train_forecast_model():
    """
    Train a Ridge regression model on synthetic but realistic pollution data.
    The model learns the relationship between:
      - current severity
      - trend direction
      - time (hour)
    and the future severity.

    In production, this would be trained on real historical sensor data.
    For now, we generate a realistic training set based on oceanographic
    diffusion principles.
    """
    np.random.seed(42)
    n_samples = 500

    # Generate training data
    current_severity = np.random.uniform(1, 10, n_samples)
    trend_factor = np.random.choice([-0.12, 0.02, 0.15], n_samples)  # decreasing, stable, increasing
    hours = np.random.randint(1, 7, n_samples)

    # Target: future severity based on diffusion + trend + seasonal + noise
    # Physics-inspired: severity changes follow advection-diffusion with seasonal forcing
    seasonal = 0.3 * np.sin(hours * 0.8)
    diffusion = -0.05 * current_severity * np.log1p(hours)  # natural dispersion
    noise = np.random.normal(0, 0.15, n_samples)

    future_severity = current_severity + trend_factor * hours + seasonal + diffusion + noise
    future_severity = np.clip(future_severity, 1.0, 10.0)

    # Features: [current_severity, trend_factor, hour]
    X = np.column_stack([current_severity, trend_factor, hours])
    y = future_severity

    # Polynomial Ridge regression — captures non-linear diffusion curves
    model = make_pipeline(
        PolynomialFeatures(degree=2, include_bias=False),
        Ridge(alpha=0.1)
    )
    model.fit(X, y)

    return model


# Train once at module load (fast — 500 samples)
_model = train_forecast_model()


def forecast(severity: float, trend: str) -> list:
    """Predict next 6 hours of pollution severity using trained regression model."""
    trend_map = {"increasing": 0.15, "stable": 0.02, "decreasing": -0.12}
    slope = trend_map.get(trend, 0.02)

    predictions = []
    for h in range(1, 7):
        X = np.array([[severity, slope, h]])
        projected = float(_model.predict(X)[0])
        projected = round(float(np.clip(projected, 1.0, 10.0)), 2)
        predictions.append({"hour": int(h), "label": f"+{h}h", "severity": projected})

    return predictions


def parse_input(raw: str) -> dict:
    raw = raw.strip().replace('\\', '')
    try:
        return json.loads(raw)
    except:
        pass
    fixed = re.sub(r'([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', raw).replace("'", '"')
    try:
        return json.loads(fixed)
    except:
        pass
    m_sev = re.search(r'severity["\']?\s*:\s*([0-9.-]+)', raw)
    m_trend = re.search(r'trend["\']?\s*:\s*["\']?([a-zA-Z]+)', raw)
    return {
        "severity": float(m_sev.group(1)) if m_sev else 5.0,
        "trend": m_trend.group(1) if m_trend else "stable",
    }


def main():
    try:
        raw_input = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else sys.stdin.read()
        data = parse_input(raw_input)
        severity = float(data.get("severity", 5.0))
        trend = str(data.get("trend", "stable"))
        name = str(data.get("name", "Pollution Event"))

        preds = forecast(severity, trend)
        result = {
            "status": "success",
            "event": name,
            "currentSeverity": severity,
            "trend": trend,
            "model": "ridge-polynomial-regression",
            "predictions": preds,
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))


if __name__ == "__main__":
    main()
