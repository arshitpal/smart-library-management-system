"""Loads the trained model and turns features into fine estimates."""
import json
from pathlib import Path

import joblib
import pandas as pd

MODELS = Path(__file__).resolve().parent.parent / "models"
MODEL_PATH = MODELS / "fine_model.joblib"
METRICS_PATH = MODELS / "metrics.json"

FEATURES = ["days_remaining", "issue_duration_days", "prior_late_count", "avg_late_days",
            "prior_overdue_ratio", "borrowing_frequency", "category_name"]


class Predictor:
    def __init__(self):
        self.model = None
        self.metrics = None
        if MODEL_PATH.exists() and METRICS_PATH.exists():
            self.model = joblib.load(MODEL_PATH)
            self.metrics = json.loads(METRICS_PATH.read_text())

    @property
    def ready(self):
        return self.model is not None

    def predict(self, instances):
        """A forest can break known facts, so results are kept within the rule's limits."""
        frame = pd.DataFrame([item.model_dump() for item in instances])
        raw = self.model.predict(frame[FEATURES])
        results = []
        for value, item in zip(raw, instances):
            estimate = max(float(value), item.floor, 0.0)
            if item.cap is not None:
                estimate = min(estimate, item.cap)
            results.append(round(estimate, 2))
        return results
