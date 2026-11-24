"""Private HTTP inference adapter for DeepSea Guardian on Vercel Services."""
from functools import lru_cache
from pathlib import Path
import base64
import io

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from predict_server import load_model, predict as run_anomaly
from forecast_spread import forecast as run_forecast

app = FastAPI(title="DeepSea Guardian ML", docs_url=None, redoc_url=None, openapi_url=None)
MODEL_PATH = Path(__file__).with_name("anomaly_model.pkl")


class Telemetry(BaseModel):
    temperature: float = Field(ge=-5, le=50)
    ph: float = Field(ge=0, le=14)
    salinity: float = Field(ge=0, le=50)
    oxygen: float = Field(ge=0, le=20)
    turbidity: float = Field(ge=0, le=1000)


class ForecastRequest(BaseModel):
    severity: float = Field(ge=1, le=10)
    trend: str = "stable"
    name: str = "Pollution Event"


class ImageRequest(BaseModel):
    image_b64: str


@lru_cache(maxsize=1)
def anomaly_model():
    return load_model()


@app.get("/health")
def health():
    return {"status": "ok", "modelAvailable": MODEL_PATH.is_file()}


@app.post("/predict")
def predict(payload: Telemetry):
    try:
        model, scaler = anomaly_model()
        return run_anomaly(model, scaler, payload.model_dump())
    except Exception:
        raise HTTPException(status_code=503, detail="Anomaly model unavailable")


@app.post("/forecast")
def forecast(payload: ForecastRequest):
    if payload.trend not in {"stable", "increasing", "decreasing"}:
        raise HTTPException(status_code=422, detail="Invalid trend")
    return {
        "status": "success",
        "event": payload.name,
        "currentSeverity": payload.severity,
        "trend": payload.trend,
        "model": "ridge-polynomial-regression",
        "predictions": run_forecast(payload.severity, payload.trend),
    }


@app.post("/classify")
def classify(payload: ImageRequest):
    try:
        import classify_species_server as classifier
        from PIL import Image
        if classifier._kind is None:
            classifier.load_model()
        if classifier._kind is None:
            raise HTTPException(status_code=503, detail="Species model unavailable")
        raw = base64.b64decode(payload.image_b64.split(",", 1)[-1], validate=True)
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large")
        with Image.open(io.BytesIO(raw)) as frame:
            species, confidence = classifier.predict(frame)
        return {"status": "success", "species": species, "confidence": confidence}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid image or model inference failed")
