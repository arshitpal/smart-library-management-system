"""Trains Random Forest and Linear Regression, then evaluates both on the test set.

Run from the ml-service folder:  python training/train.py
"""
import json
from datetime import date
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parent.parent
MODEL_VERSION = "rf-synthetic-v1"
DATA_SOURCE = "SYNTHETIC"
SEED = 42

NUMERIC = ["days_remaining", "issue_duration_days", "prior_late_count", "avg_late_days",
           "prior_overdue_ratio", "borrowing_frequency"]
CATEGORICAL = ["category_name"]
FEATURES = NUMERIC + CATEGORICAL
TARGET = "fine"


def preprocessor(scale):
    numeric = StandardScaler() if scale else "passthrough"
    return ColumnTransformer([
        ("numeric", numeric, NUMERIC),
        ("category", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
    ])


def evaluate(model, x, y):
    predicted = np.clip(model.predict(x), 0, None)
    mse = mean_squared_error(y, predicted)
    return {
        "mae": round(float(mean_absolute_error(y, predicted)), 3),
        "mse": round(float(mse), 3),
        "rmse": round(float(np.sqrt(mse)), 3),
        "r2": round(float(r2_score(y, predicted)), 4),
    }


def tune_forest(x, y):
    """Tuned on training data only. Folds keep time order, so no fold sees its future."""
    search = GridSearchCV(
        Pipeline([
            ("prepare", preprocessor(scale=False)),
            ("model", RandomForestRegressor(n_estimators=150, random_state=SEED, n_jobs=-1)),
        ]),
        {"model__max_depth": [8, 14, None], "model__min_samples_leaf": [2, 5, 10]},
        cv=TimeSeriesSplit(n_splits=4),
        scoring="neg_mean_absolute_error",
    )
    search.fit(x, y)
    print("Best settings:", search.best_params_)
    return search.best_estimator_, search.best_params_


def importances(forest):
    names = forest.named_steps["prepare"].get_feature_names_out()
    values = forest.named_steps["model"].feature_importances_
    pairs = sorted(zip(names, values), key=lambda pair: pair[1], reverse=True)
    return [{"feature": name.split("__")[-1], "importance": round(float(v), 4)} for name, v in pairs]


def main():
    train = pd.read_csv(ROOT / "datasets" / "synthetic_train.csv")
    test = pd.read_csv(ROOT / "datasets" / "synthetic_test.csv")
    x_train, y_train = train[FEATURES], train[TARGET]
    x_test, y_test = test[FEATURES], test[TARGET]

    forest, best = tune_forest(x_train, y_train)
    linear = Pipeline([("prepare", preprocessor(scale=True)), ("model", LinearRegression())])
    linear.fit(x_train, y_train)

    (ROOT / "models").mkdir(exist_ok=True)
    joblib.dump(forest, ROOT / "models" / "fine_model.joblib", compress=3)

    sample = test.sample(min(150, len(test)), random_state=SEED)
    metrics = {
        "model_version": MODEL_VERSION,
        "data_source": DATA_SOURCE,
        "trained_on": date.today().isoformat(),
        "train_rows": len(train),
        "test_rows": len(test),
        "train_period": [train["snapshot_date"].min(), train["snapshot_date"].max()],
        "test_period": [test["snapshot_date"].min(), test["snapshot_date"].max()],
        "best_params": {key.replace("model__", ""): value for key, value in best.items()},
        "random_forest": evaluate(forest, x_test, y_test),
        "linear_regression": evaluate(linear, x_test, y_test),
        "baseline_predict_mean": evaluate(DummyRegressor(strategy="mean").fit(x_train, y_train), x_test, y_test),
        "feature_importance": importances(forest),
        "sample_points": [
            {"actual": float(a), "predicted": round(float(p), 2)}
            for a, p in zip(sample[TARGET], np.clip(forest.predict(sample[FEATURES]), 0, None))
        ],
    }
    (ROOT / "models" / "metrics.json").write_text(json.dumps(metrics, indent=2))
    for name in ["random_forest", "linear_regression", "baseline_predict_mean"]:
        print(name, metrics[name])
    print("Importance:", metrics["feature_importance"][:4])


if __name__ == "__main__":
    main()
