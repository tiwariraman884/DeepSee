"""
Classify an image of a sea animal.
Takes a base64 encoded image string as input (via command line arg),
returns JSON with species name and confidence.
"""
import sys, json, base64, io, os
import numpy as np
from PIL import Image
import joblib

MODEL_PATH = os.path.join(os.path.dirname(__file__), "species_classifier.pkl")
IMG_SIZE = (32, 32)

def extract_features(img):
    try:
        img = img.convert("RGB").resize(IMG_SIZE)
        
        hist_r = img.histogram()[0:256]
        hist_g = img.histogram()[256:512]
        hist_b = img.histogram()[512:768]
        
        hist = np.array(hist_r + hist_g + hist_b)
        hist = hist.reshape(3, 32, 8).sum(axis=1).flatten()
        
        pixels = np.array(img).flatten() / 255.0
        
        return np.concatenate([hist / (IMG_SIZE[0]*IMG_SIZE[1]), pixels])
    except:
        return None

def main():
    try:
        # Input should be JSON with {"image_b64": "..."} via stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        b64_str = data.get("image_b64", "")
        
        # Remove data:image/jpeg;base64, if present
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]
            
        image_bytes = base64.b64decode(b64_str)
        img = Image.open(io.BytesIO(image_bytes))
        
        feats = extract_features(img)
        if feats is None:
            print(json.dumps({"status": "error", "message": "Failed to process image"}))
            return
            
        clf = joblib.load(MODEL_PATH)
        X = feats.reshape(1, -1)
        
        pred = clf.predict(X)[0]
        probs = clf.predict_proba(X)[0]
        conf = float(np.max(probs))
        
        print(json.dumps({
            "status": "success",
            "species": str(pred),
            "confidence": conf
        }))
        
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))

if __name__ == "__main__":
    main()
