"""
Classify an image of a sea animal.
Takes a JSON payload on stdin: {"image_b64": "data:image/jpeg;base64,..."}
Prints JSON to stdout: {"status": "success", "species": "...", "confidence": 0.94}

Uses the transfer-learning model (MobileNetV3-Small, 224x224) trained by
train_species_classifier_v2.py. Falls back to the legacy scikit-learn model if
the PyTorch checkpoint is missing, so an un-migrated checkout still works.
"""
import sys, json, base64, io, os

MODEL_PT = os.path.join(os.path.dirname(__file__), "species_classifier.pt")
MODEL_PKL = os.path.join(os.path.dirname(__file__), "species_classifier.pkl")

# Cached per-process so repeated calls in one interpreter skip the model load.
_state = {"model": None, "classes": None, "tf": None, "kind": None}


def _load_torch():
    """Load the PyTorch checkpoint (architecture is rebuilt then state loaded)."""
    import torch
    import torch.nn as nn
    from torchvision import transforms, models

    ckpt = torch.load(MODEL_PT, map_location="cpu", weights_only=False)
    classes = ckpt["classes"]
    img_size = ckpt.get("img_size", 224)
    mean = ckpt.get("mean", [0.485, 0.456, 0.406])
    std = ckpt.get("std", [0.229, 0.224, 0.225])

    model = models.mobilenet_v3_small(weights=None)
    model.classifier[3] = nn.Linear(model.classifier[3].in_features, len(classes))
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    tf = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean, std),
    ])
    return model, classes, tf


def _predict_torch(img, model, classes, tf):
    import torch
    tensor = tf(img.convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        probs = torch.softmax(model(tensor), dim=1)[0]
    idx = int(torch.argmax(probs))
    return classes[idx], float(probs[idx])


def _predict_legacy(img, clf):
    """Legacy path: 32x32 pixels + colour histogram -> Random Forest."""
    import numpy as np
    IMG_SIZE = (32, 32)
    im = img.convert("RGB").resize(IMG_SIZE)

    hist_r = im.histogram()[0:256]
    hist_g = im.histogram()[256:512]
    hist_b = im.histogram()[512:768]
    hist = np.array(hist_r + hist_g + hist_b)
    hist = hist.reshape(3, 32, 8).sum(axis=1).flatten()
    pixels = np.array(im).flatten() / 255.0

    feats = np.concatenate([hist / (IMG_SIZE[0] * IMG_SIZE[1]), pixels]).reshape(1, -1)
    pred = clf.predict(feats)[0]
    conf = float(np.max(clf.predict_proba(feats)[0]))
    return str(pred), conf


def main():
    try:
        # Input should be JSON with {"image_b64": "..."} via stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        b64_str = data.get("image_b64", "")

        # Remove data:image/jpeg;base64, if present
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]

        from PIL import Image
        image_bytes = base64.b64decode(b64_str)
        img = Image.open(io.BytesIO(image_bytes))

        # Prefer the transfer-learning model; fall back if it is absent.
        if _state["kind"] is None:
            if os.path.exists(MODEL_PT):
                try:
                    _state["model"], _state["classes"], _state["tf"] = _load_torch()
                    _state["kind"] = "torch"
                except Exception as exc:
                    print(f"[classify_species] torch load failed: {exc}", file=sys.stderr)
            if _state["kind"] is None and os.path.exists(MODEL_PKL):
                import joblib
                _state["model"] = joblib.load(MODEL_PKL)
                _state["kind"] = "legacy"

        if _state["kind"] == "torch":
            species, conf = _predict_torch(img, _state["model"], _state["classes"], _state["tf"])
        elif _state["kind"] == "legacy":
            species, conf = _predict_legacy(img, _state["model"])
        else:
            print(json.dumps({
                "status": "error",
                "message": "No model found. Run train_species_classifier_v2.py first.",
            }))
            return

        print(json.dumps({
            "status": "success",
            "species": species,
            "confidence": conf,
        }))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))


if __name__ == "__main__":
    main()
