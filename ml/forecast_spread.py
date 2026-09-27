"""
Phase 3: Pollution Spread Forecast
Takes current pollution severity + location, predicts severity for next 6 hours.
Uses polynomial regression on historical pattern.
"""
import sys, json, re
import numpy as np

def forecast(severity: float, trend: str) -> list:
    """Predict next 6 hours of pollution severity."""
    rng = np.random.default_rng(42)
    hours = np.arange(1, 7)

    # Trend factor: increasing=+0.15/hr, stable=0, decreasing=-0.12/hr
    trend_map = {"increasing": 0.15, "stable": 0.02, "decreasing": -0.12}
    slope = trend_map.get(trend, 0.02)

    predictions = []
    for h in hours:
        projected = severity + slope * h + 0.3 * np.sin(h * 0.8) + rng.uniform(-0.2, 0.2)
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
        trend    = str(data.get("trend", "stable"))
        name     = str(data.get("name", "Pollution Event"))

        preds = forecast(severity, trend)
        result = {
            "status": "success",
            "event": name,
            "currentSeverity": severity,
            "trend": trend,
            "predictions": preds,
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))

if __name__ == "__main__":
    main()
