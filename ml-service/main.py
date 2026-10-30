"""Private fine-estimate service. Only the Node backend calls it, and it never touches MySQL."""
import os
import secrets

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.predictor import Predictor

load_dotenv()
SERVICE_KEY = os.getenv("SERVICE_KEY", "")

app = FastAPI(title="Smart Library Fine Prediction Service", docs_url=None, redoc_url=None)
predictor = Predictor()


def require_key(x_service_key: str = Header(default="")):
    if not SERVICE_KEY or not secrets.compare_digest(x_service_key, SERVICE_KEY):
        raise HTTPException(status_code=401, detail="Invalid service key")


def require_model():
    if not predictor.ready:
        raise HTTPException(status_code=503, detail="Model not trained")


class Instance(BaseModel):
    days_remaining: int
    issue_duration_days: int = Field(ge=0)
    prior_late_count: int = Field(ge=0)
    avg_late_days: float = Field(ge=0)
    prior_overdue_ratio: float = Field(ge=0, le=1)
    category_name: str
    borrowing_frequency: int = Field(ge=0)
    floor: float = Field(default=0, ge=0)
    cap: float | None = Field(default=None, ge=0)


class PredictRequest(BaseModel):
    instances: list[Instance] = Field(min_length=1, max_length=20)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": predictor.ready}


@app.post("/predict", dependencies=[Depends(require_key), Depends(require_model)])
def predict(request: PredictRequest):
    return {
        "predictions": predictor.predict(request.instances),
        "model_version": predictor.metrics["model_version"],
        "data_source": predictor.metrics["data_source"],
    }


@app.get("/metrics", dependencies=[Depends(require_key), Depends(require_model)])
def metrics():
    return predictor.metrics
