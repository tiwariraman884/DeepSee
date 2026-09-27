"""
Phase 4 (v1): Train Species Classifier — DEPRECATED
===================================================

Superseded by train_species_classifier_v2.py.

This script uses 32x32 downscaled raw pixels + colour histograms as features for
a Random Forest. That approach reached only ~26.7% validation accuracy: at 32x32 a
whale and a shark are both grey blobs, so the features mostly encode water colour
and lighting rather than anatomy. 3,096 raw-pixel features over ~2,300 samples also
memorised the training set (100% train accuracy).

Kept only for reference and for reproducing the original baseline. Do NOT use its
output for the shipped classifier — run train_species_classifier_v2.py instead.
"""
import os, glob, json, sys
import numpy as np
from PIL import Image
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

DATASET_PATH = r"C:\Users\Lenovo\.cache\kagglehub\datasets\vencerlanz09\sea-animals-image-dataste\versions\5"
MODEL_OUT = "species_classifier.pkl"
METRICS_OUT = "species_classifier_metrics.json"
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

# ── Hold-out validation split ─────────────────────────────────────────────────
# Report GENERALISATION accuracy, not just training accuracy. Training accuracy
# on its own is misleading because the Random Forest sees those samples.
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"\nSplit: {X_train.shape[0]} train / {X_test.shape[0]} validation samples")

clf.fit(X_train, y_train)

# Evaluate
train_acc = clf.score(X_train, y_train)
val_acc = accuracy_score(y_test, clf.predict(X_test))
print(f"Training Accuracy  : {train_acc:.2%}")
print(f"Validation Accuracy: {val_acc:.2%}")
if train_acc - val_acc > 0.15:
    print("  WARNING: large train/val gap -> the model is overfitting.")

report = classification_report(y_test, clf.predict(X_test), zero_division=0, output_dict=True)
print("\nPer-class validation report:")
print(classification_report(y_test, clf.predict(X_test), zero_division=0))

# ── Persist metrics for the UI / README ──────────────────────────────────────
labels = sorted(set(y))
metrics = {
    "dataset": "vencerlanz09/sea-animals-image-dataste",
    "imgSize": list(IMG_SIZE),
    "maxImagesPerClass": MAX_IMAGES_PER_CLASS,
    "totalSamples": int(X.shape[0]),
    "featureCount": int(X.shape[1]),
    "trainSamples": int(X_train.shape[0]),
    "validationSamples": int(X_test.shape[0]),
    "classCount": len(labels),
    "classes": labels,
    "trainAccuracy": round(float(train_acc), 4),
    "validationAccuracy": round(float(val_acc), 4),
    "macroF1": round(float(report["macro avg"]["f1-score"]), 4),
    "weightedF1": round(float(report["weighted avg"]["f1-score"]), 4),
    "perClass": {
        lbl: {
            "precision": round(float(report[lbl]["precision"]), 4),
            "recall": round(float(report[lbl]["recall"]), 4),
            "f1": round(float(report[lbl]["f1-score"]), 4),
            "support": int(report[lbl]["support"]),
        }
        for lbl in labels if lbl in report
    },
    "confusionMatrix": confusion_matrix(y_test, clf.predict(X_test), labels=labels).tolist(),
    "confusionLabels": labels,
}
with open(METRICS_OUT, "w", encoding="utf-8") as fh:
    json.dump(metrics, fh, indent=2)
print(f"Metrics written to '{METRICS_OUT}'")

# ── Refit on the FULL dataset before saving ──────────────────────────────────
# The held-out split exists only to measure quality. The shipped model should
# still learn from every available sample.
clf.fit(X, y)
joblib.dump(clf, MODEL_OUT)
print(f"Model saved to '{MODEL_OUT}' (trained on all {X.shape[0]} samples)")
print("Phase 4 COMPLETE.")
