"""
DeepSea ML service — HTTP entrypoint
====================================
Vercel deploys this file as the `ml` service (see vercel.json: `"entrypoint":
"app.py"`). The Python runtime loads the module-level `app` object and serves it
as a Vercel Function, so the backend reaches it over the internal service
binding injected as `ML_SERVICE_URL`.

The NDJSON servers next to this file (predict_server.py, classify_species_server.py)
are still the local/desktop transport: they are child processes of the Node
backend and cannot be spawned inside a serverless function. This module reuses
the same model-loading and prediction code so both transports produce identical
results:

    POST /predict   {temperature, ph, salinity, oxygen, turbidity}
                    -> {isAnomaly, score, status, latency_ms}
    POST /classify  {image_b64: "data:image/webp;base64,..."}
                    -> {status, species, confidence}
    GET  /health    -> {status, ready}

Model loading is lazy (first request) and cached for the life of the instance:
Vercel Functions scale to zero, so importing torch eagerly at module scope would
make every cold start pay the full ~6s checkpoint cost even for /health.
"""
import base64
import io
import os
import time

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

HERE = os.path.dirname(os.path.abspath(__file__))

ANOMALY_MODEL = os.path.join(HERE, "anomaly_model.pkl")
ANOMALY_SCALER = os.path.join(HERE, "anomaly_scaler.pkl")
FEATURE_ORDER = ["temperature", "ph", "salinity", "oxygen", "turbidity"]

SPECIES_PT = os.path.join(HERE, "species_classifier.pt")
SPECIES_PKL = os.path.join(HERE, "species_classifier.pkl")

app = FastAPI(title="DeepSea ML service")

# ─── Anomaly detector (ml/predict_server.py, same feature schema) ─────────────
_anomaly = {"model": None, "scaler": None, "error": None}


def _load_anomaly():
    if _anomaly["model"] is not None or _anomaly["error"] is not None:
        return
    try:
        import joblib

        if not os.path.exists(ANOMALY_MODEL):
            _anomaly["error"] = "anomaly_model.pkl not found in the ml service bundle"
            return
        _anomaly["model"] = joblib.load(ANOMALY_MODEL)
        if os.path.exists(ANOMALY_SCALER):
            _anomaly["scaler"] = joblib.load(ANOMALY_SCALER)
    except Exception as exc:  # missing sklearn, corrupt pickle, ...
        _anomaly["error"] = f"could not load anomaly model: {exc}"


# ─── Species classifier (ml/classify_species_server.py, same load order) ──────
_species = {"model": None, "classes": None, "tf": None, "kind": None, "error": None}


def _load_species():
    if _species["kind"] is not None or _species["error"] is not None:
        return
    if os.path.exists(SPECIES_PT):
        try:
            import torch
            import torch.nn as nn
            from torchvision import transforms, models

            ckpt = torch.load(SPECIES_PT, map_location="cpu", weights_only=False)
            classes = ckpt["classes"]
            img_size = ckpt.get("img_size", 224)
            mean = ckpt.get("mean", [0.485, 0.456, 0.406])
            std = ckpt.get("std", [0.229, 0.224, 0.225])

            model = models.mobilenet_v3_small(weights=None)
            model.classifier[3] = nn.Linear(model.classifier[3].in_features, len(classes))
            model.load_state_dict(ckpt["state_dict"])
            model.eval()

            _species["tf"] = transforms.Compose([
                transforms.Resize((img_size, img_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean, std),
            ])
            _species["model"] = model
            _species["classes"] = classes
            _species["kind"] = "torch"
            return
        except Exception as exc:
            print(f"[ML-APP] torch load failed: {exc}", flush=True)

    if os.path.exists(SPECIES_PKL):
        try:
            import joblib

            _species["model"] = joblib.load(SPECIES_PKL)
            _species["kind"] = "legacy"
            return
        except Exception as exc:
            _species["error"] = f"could not load species model: {exc}"
            return

    _species["error"] = "no species model in the ml service bundle"


# ─── Request schemas ──────────────────────────────────────────────────────────
class SensorReading(BaseModel):
    temperature: float
    ph: float
    salinity: float
    oxygen: float
    turbidity: float


class ClassifyRequest(BaseModel):
    image_b64: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "anomalyModel": os.path.exists(ANOMALY_MODEL),
        "speciesModel": os.path.exists(SPECIES_PT) or os.path.exists(SPECIES_PKL),
        "loaded": {
            "anomaly": _anomaly["model"] is not None,
            "species": _species["kind"] is not None,
        },
    }


@app.post("/predict")
def predict(reading: SensorReading):
    _load_anomaly()
    if _anomaly["error"]:
        return JSONResponse(status_code=503, content={"status": "error", "message": _anomaly["error"]})

    import pandas as pd

    t0 = time.perf_counter()
    data = reading.model_dump()
    X = pd.DataFrame([[data[f] for f in FEATURE_ORDER]], columns=FEATURE_ORDER)
    if _anomaly["scaler"] is not None:
        X = _anomaly["scaler"].transform(X)
    model = _anomaly["model"]
    pred = model.predict(X)[0]
    score = float(model.score_samples(X)[0])
    return {
        "isAnomaly": bool(pred == -1),
        "score": round(score, 4),
        "status": "success",
        "latency_ms": round((time.perf_counter() - t0) * 1000, 3),
    }


@app.post("/classify")
def classify(req: ClassifyRequest):
    _load_species()
    if _species["error"]:
        return JSONResponse(status_code=503, content={"status": "error", "message": _species["error"]})

    from PIL import Image

    b64 = req.image_b64
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    img = Image.open(io.BytesIO(base64.b64decode(b64)))

    try:
        if _species["kind"] == "torch":
            import torch

            tensor = _species["tf"](img.convert("RGB")).unsqueeze(0)
            with torch.no_grad():
                probs = torch.softmax(_species["model"](tensor), dim=1)[0]
            idx = int(torch.argmax(probs))
            return {"status": "success", "species": _species["classes"][idx], "confidence": float(probs[idx])}

        import numpy as np

        size = (32, 32)
        im = img.convert("RGB").resize(size)
        hist = np.array(im.histogram()[0:256] + im.histogram()[256:512] + im.histogram()[512:768])
        hist = hist.reshape(3, 32, 8).sum(axis=1).flatten()
        pixels = np.array(im).flatten() / 255.0
        feats = np.concatenate([hist / (size[0] * size[1]), pixels]).reshape(1, -1)
        pred = _species["model"].predict(feats)[0]
        conf = float(np.max(_species["model"].predict_proba(feats)[0]))
        return {"status": "success", "species": str(pred), "confidence": conf}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})


if __name__ == "__main__":
    # Local smoke test: `python ml/app.py` then curl localhost:8000/health
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("ML_PORT", "8000")))
