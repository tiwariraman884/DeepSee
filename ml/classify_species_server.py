"""
Long-running species-classification inference server.

Reads one JSON request per line from stdin and writes one JSON response per
line to stdout:

  in : {"image_b64": "data:image/webp;base64,..."}
  out: {"status": "success", "species": "Whale", "confidence": 0.944}

Why this exists: spawning a fresh Python process per request costs ~15s with the
legacy scikit-learn model and ~44s with the PyTorch transfer-learning model,
because every call re-imports torch and reloads the checkpoint. The frontend's
dev proxy gives up long before that and reports "socket hang up". Keeping the
model resident drops per-request latency to well under a second.
"""
import sys, json, base64, io, os, time

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PT = os.path.join(HERE, "species_classifier.pt")
MODEL_PKL = os.path.join(HERE, "species_classifier.pkl")

_model = None
_classes = None
_tf = None
_kind = None


def load_model():
    """Load the best available model once at startup."""
    global _model, _classes, _tf, _kind

    if os.path.exists(MODEL_PT):
        try:
            import torch
            import torch.nn as nn
            from torchvision import transforms, models

            ckpt = torch.load(MODEL_PT, map_location="cpu", weights_only=False)
            _classes = ckpt["classes"]
            img_size = ckpt.get("img_size", 224)
            mean = ckpt.get("mean", [0.485, 0.456, 0.406])
            std = ckpt.get("std", [0.229, 0.224, 0.225])

            model = models.mobilenet_v3_small(weights=None)
            model.classifier[3] = nn.Linear(model.classifier[3].in_features, len(_classes))
            model.load_state_dict(ckpt["state_dict"])
            model.eval()

            _tf = transforms.Compose([
                transforms.Resize((img_size, img_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean, std),
            ])
            _model = model
            _kind = "torch"
            return
        except Exception as exc:
            print(f"[SPECIES-SERVER] torch load failed: {exc}", file=sys.stderr, flush=True)

    if os.path.exists(MODEL_PKL):
        import joblib
        _model = joblib.load(MODEL_PKL)
        _kind = "legacy"


def predict(img):
    if _kind == "torch":
        import torch
        tensor = _tf(img.convert("RGB")).unsqueeze(0)
        with torch.no_grad():
            probs = torch.softmax(_model(tensor), dim=1)[0]
        idx = int(torch.argmax(probs))
        return _classes[idx], float(probs[idx])

    if _kind == "legacy":
        import numpy as np
        IMG_SIZE = (32, 32)
        im = img.convert("RGB").resize(IMG_SIZE)
        hist = np.array(
            im.histogram()[0:256] + im.histogram()[256:512] + im.histogram()[512:768]
        )
        hist = hist.reshape(3, 32, 8).sum(axis=1).flatten()
        pixels = np.array(im).flatten() / 255.0
        feats = np.concatenate([hist / (IMG_SIZE[0] * IMG_SIZE[1]), pixels]).reshape(1, -1)
        pred = _model.predict(feats)[0]
        return str(pred), float(np.max(_model.predict_proba(feats)[0]))

    raise RuntimeError("No model loaded")


def main():
    t0 = time.time()
    load_model()
    if _kind is None:
        print(json.dumps({
            "type": "ready",
            "ok": False,
            "error": "No model found. Run train_species_classifier_v2.py first.",
        }), flush=True)
        return

    print(json.dumps({
        "type": "ready",
        "ok": True,
        "kind": _kind,
        "classes": len(_classes) if _classes else None,
        "loadMs": int((time.time() - t0) * 1000),
    }), flush=True)

    from PIL import Image
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
            if data.get("action") == "shutdown":
                break

            b64_str = data.get("image_b64", "")
            if "," in b64_str:
                b64_str = b64_str.split(",")[1]

            img = Image.open(io.BytesIO(base64.b64decode(b64_str)))
            species, conf = predict(img)
            print(json.dumps({
                "status": "success",
                "species": species,
                "confidence": conf,
            }), flush=True)

        except Exception as exc:
            print(json.dumps({"status": "error", "message": str(exc)}), flush=True)


if __name__ == "__main__":
    main()