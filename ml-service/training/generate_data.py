"""Creates SYNTHETIC loan data and splits it by time into train and test files.

Every simulated student has a hidden lateness tendency, so past behaviour really
does predict future behaviour. All of this data is invented, and the metrics it
produces show how well the model recovers these built-in patterns, nothing more.

Run from the ml-service folder:  python training/generate_data.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 42
STUDENTS = 500
START = pd.Timestamp("2023-01-01")
DAYS = 1095
TRAIN_FRACTION = 0.8
FREQUENCY_WINDOW_DAYS = 180
DATASETS = Path(__file__).resolve().parent.parent / "datasets"

# Same sample rules as database/seed.sql.
DEFAULT_RULE = {"loan_days": 14, "grace_days": 1, "daily_rate": 5.0, "max_fine": 500.0}
REFERENCE_RULE = {"loan_days": 7, "grace_days": 0, "daily_rate": 10.0, "max_fine": 1000.0}

# Category name -> (share of loans, added chance of being late)
CATEGORIES = {
    "Computer Science": (0.35, 0.05),
    "Mathematics": (0.15, 0.03),
    "Management": (0.15, -0.02),
    "Literature": (0.15, 0.08),
    "Reference": (0.10, 0.10),
    "Electronics": (0.10, 0.00),
}


def rule_for(category):
    return REFERENCE_RULE if category == "Reference" else DEFAULT_RULE


def fine_for(late_days, rule):
    """Mirrors calculateFine in backend/services/fineService.js."""
    chargeable = max(late_days - rule["grace_days"], 0)
    return min(chargeable * rule["daily_rate"], rule["max_fine"])


def simulate_loans(rng):
    names = list(CATEGORIES)
    shares = [CATEGORIES[name][0] for name in names]
    loans = []
    for student in range(STUDENTS):
        tendency = rng.beta(2, 5)
        loans_per_year = rng.uniform(4, 24)
        count = rng.poisson(loans_per_year * DAYS / 365)
        for day in np.sort(rng.integers(0, DAYS, count)):
            category = rng.choice(names, p=shares)
            rule = rule_for(category)
            issue_date = START + pd.Timedelta(days=int(day))
            due_date = issue_date + pd.Timedelta(days=rule["loan_days"])

            if rng.random() < np.clip(tendency + CATEGORIES[category][1], 0.01, 0.95):
                # Late students are late by more, and delays have a long tail.
                late_days = 1 + int(rng.gamma(1.5, 2 + 12 * tendency))
            else:
                late_days = -int(rng.integers(0, rule["loan_days"] + 1))

            loans.append({
                "student": student,
                "category_name": category,
                "issue_date": issue_date,
                "due_date": due_date,
                "return_date": due_date + pd.Timedelta(days=late_days),
                "fine": fine_for(max(late_days, 0), rule),
            })
    frame = pd.DataFrame(loans)
    frame["loan_id"] = frame.index
    return frame


def features_at(loan, snapshot, history):
    """Features as they looked on the snapshot date, excluding the current loan."""
    others = history[history["loan_id"] != loan["loan_id"]]
    returned = others[others["return_date"] <= snapshot]
    late_days = (returned["return_date"] - returned["due_date"]).dt.days
    late = late_days[late_days > 0]
    window_start = snapshot - pd.Timedelta(days=FREQUENCY_WINDOW_DAYS)
    started = others[(others["issue_date"] >= window_start) & (others["issue_date"] <= snapshot)]
    return {
        "days_remaining": (loan["due_date"] - snapshot).days,
        "issue_duration_days": (loan["due_date"] - loan["issue_date"]).days,
        "prior_late_count": len(late),
        "avg_late_days": round(float(late.mean()), 2) if len(late) else 0.0,
        "prior_overdue_ratio": round(len(late) / len(returned), 4) if len(returned) else 0.0,
        "category_name": loan["category_name"],
        "borrowing_frequency": len(started),
    }


def build_rows(loans, rng):
    rows = []
    for _, history in loans.groupby("student"):
        for _, loan in history.iterrows():
            # One snapshot per loan, drawn only from days the book was really out.
            span = (loan["return_date"] - loan["issue_date"]).days
            snapshot = loan["issue_date"] + pd.Timedelta(days=int(rng.integers(0, span + 1)))
            rows.append({
                "loan_id": loan["loan_id"],
                "snapshot_date": snapshot,
                "issue_date": loan["issue_date"],
                "return_date": loan["return_date"],
                **features_at(loan, snapshot, history),
                "fine": loan["fine"],
            })
    return pd.DataFrame(rows).sort_values("snapshot_date", ignore_index=True)


def main():
    rng = np.random.default_rng(SEED)
    loans = simulate_loans(rng)
    rows = build_rows(loans, rng)

    cutoff = START + pd.Timedelta(days=int(DAYS * TRAIN_FRACTION))
    # A training label must already be known at the cutoff, so use the return date.
    train = rows[rows["return_date"] < cutoff]
    test = rows[rows["issue_date"] >= cutoff]

    DATASETS.mkdir(exist_ok=True)
    train.to_csv(DATASETS / "synthetic_train.csv", index=False)
    test.to_csv(DATASETS / "synthetic_test.csv", index=False)
    print(f"Cutoff {cutoff.date()}: {len(train)} train rows, {len(test)} test rows")
    print(f"Loans with a fine: train {(train['fine'] > 0).mean():.1%}, test {(test['fine'] > 0).mean():.1%}")


if __name__ == "__main__":
    main()
