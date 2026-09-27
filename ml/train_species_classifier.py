"""
Phase 4: Train Lightweight Species Classifier (Computer Vision)
Uses the Sea Animals dataset. Extracts basic features (color histogram + downscaled pixels)
and trains a Random Forest model. Lightweight, runs on CPU.
"""
import os, glob
import numpy as np
from PIL import Image
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import joblib

DATASET_PATH = r"C:\Users\Lenovo\.cache\kagglehub\datasets\vencerlanz09\sea-animals-image-dataste\versions\5"
MODEL_OUT = "species_classifier.pkl"
IMG_SIZE = (32, 32) # Downscale heavily for fast feature extraction
MAX_IMAGES_PER_CLASS = 100 # Keep training fast

def extract_features(img_path):
    """Extract color histogram and raw pixels."""
    try:
        img = Image.open(img_path).convert("RGB").resize(IMG_SIZE)
        
        # Color histogram (8 bins per channel)
        hist_r = img.histogram()[0:256]
        hist_g = img.histogram()[256:512]
        hist_b = img.histogram()[512:768]
        
        # Bin down to 8 bins
        hist = np.array(hist_r + hist_g + hist_b)
        hist = hist.reshape(3, 32, 8).sum(axis=1).flatten()
        
        # Raw pixels
        pixels = np.array(img).flatten() / 255.0
        
        # Combine
        return np.concatenate([hist / (IMG_SIZE[0]*IMG_SIZE[1]), pixels])
    except Exception as e:
        return None

print("Phase 4: Training Sea Animals Classifier...")

X, y = [], []
classes = [d for d in os.listdir(DATASET_PATH) if os.path.isdir(os.path.join(DATASET_PATH, d))]

print(f"Found {len(classes)} classes. Extracting features...")

for cls_idx, cls_name in enumerate(classes):
    folder = os.path.join(DATASET_PATH, cls_name)
    images = glob.glob(os.path.join(folder, "*.jpg")) + glob.glob(os.path.join(folder, "*.png"))
    
    count = 0
    for img_path in images:
        if count >= MAX_IMAGES_PER_CLASS:
            break
        feats = extract_features(img_path)
        if feats is not None:
            X.append(feats)
            y.append(cls_name)
            count += 1
            
    print(f"  [{cls_name}] Extracted {count} images")

X = np.array(X)
y = np.array(y)

print(f"Total dataset: {X.shape[0]} samples. Features: {X.shape[1]}")
print("Training Random Forest model (this might take a minute)...")

clf = RandomForestClassifier(n_estimators=100, max_depth=15, n_jobs=-1, random_state=42)
clf.fit(X, y)

# Evaluate
train_acc = clf.score(X, y)
print(f"Training Accuracy: {train_acc:.2%}")

joblib.dump(clf, MODEL_OUT)
print(f"Model saved to '{MODEL_OUT}'")
print("Phase 4 COMPLETE.")
