"""Tests the actual private ML HTTP adapter and serialized payload contracts."""
import base64
import io
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import HTTPException
from main import Telemetry, ForecastRequest, ImageRequest, classify, forecast, health, predict


class ServiceIntegrationTest(unittest.TestCase):
    def test_health_reports_model_artifact(self):
        result = health()
        self.assertEqual(result["status"], "ok")
        self.assertTrue(result["modelAvailable"])

    def test_forecast_six_hours(self):
        result = forecast(ForecastRequest(severity=6.0, trend="increasing", name="Simulation"))
        self.assertEqual(result["status"], "success")
        self.assertEqual([p["hour"] for p in result["predictions"]], [1, 2, 3, 4, 5, 6])

    def test_forecast_rejects_invalid_trend(self):
        with self.assertRaises(HTTPException) as e:
            forecast(ForecastRequest(severity=6.0, trend="unknown"))
        self.assertEqual(e.exception.status_code, 422)

    def test_anomaly_inference_from_model(self):
        result = predict(Telemetry(temperature=3.1, ph=8.05, salinity=34.5,
                                   oxygen=5.2, turbidity=0.4))
        self.assertEqual(result["status"], "success")
        self.assertIn(result["isAnomaly"], (True, False))
        self.assertIsInstance(result["score"], float)

    def test_incomplete_telemetry_rejected(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            Telemetry(temperature=3.1, ph=8.0, salinity=34.5, oxygen=5.0)

    def test_legacy_species_classifier(self):
        from PIL import Image
        out = io.BytesIO()
        Image.new("RGB", (48, 48), color=(25, 85, 130)).save(out, format="PNG")
        payload = ImageRequest(image_b64=base64.b64encode(out.getvalue()).decode())
        result = classify(payload)
        self.assertEqual(result["status"], "success")
        self.assertIsInstance(result["species"], str)


if __name__ == "__main__":
    unittest.main()
