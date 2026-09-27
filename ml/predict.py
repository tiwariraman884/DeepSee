import sys
import json
import re
import os
import pandas as pd
import joblib
import warnings

warnings.filterwarnings('ignore')

MODEL_FILE = os.path.join(os.path.dirname(__file__), "anomaly_model.pkl")

def parse_input(raw: str) -> dict:
    raw = raw.strip().replace('\\', '')
    # Try standard json
    try:
        return json.loads(raw)
    except:
        pass
        
    # Fix unquoted keys like {temperature:3.1, ph:6.5} -> {"temperature":3.1, "ph":6.5}
    fixed = re.sub(r'([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', raw)
    fixed = fixed.replace("'", '"')
    try:
        return json.loads(fixed)
    except:
        pass
        
    # Manual key-value regex extraction
    features = ["temperature", "ph", "salinity", "oxygen", "turbidity"]
    data = {}
    for f in features:
        m = re.search(rf'{f}["\']?\s*:\s*([0-9.-]+)', raw, re.IGNORECASE)
        if m:
            data[f] = float(m.group(1))
    return data

def main():
    try:
        raw_input = ""
        if len(sys.argv) > 1:
            raw_input = " ".join(sys.argv[1:])
        else:
            raw_input = sys.stdin.read()
            
        data = parse_input(raw_input)
        if not data:
            raise ValueError(f"Could not parse sensor input from: {raw_input}")
            
        features = ["temperature", "ph", "salinity", "oxygen", "turbidity"]
        row = {f: float(data.get(f, 0.0)) for f in features}
        df = pd.DataFrame([row], columns=features)
        
        model = joblib.load(MODEL_FILE)
        prediction = model.predict(df)[0]
        
        result = {
            "isAnomaly": bool(prediction == -1),
            "status": "success"
        }
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "isAnomaly": False,
            "status": "error",
            "message": str(e)
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()
