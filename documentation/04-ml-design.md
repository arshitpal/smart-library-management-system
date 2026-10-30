# 4. Machine Learning Design

This design is implemented in `ml-service/`. Results are in the [project report](05-mca-project-report.md).

## 4.1 What the model does and does not do

**Question answered:** "For this book currently on loan, what fine will this student probably end up paying?"

The future return date is unknown, so that part genuinely needs estimating. The student's past behaviour is what makes the estimate useful.

| | Actual fine | Predicted fine |
|---|---|---|
| Source | Rule formula in the backend | Random Forest model |
| When | At return | While the book is out |
| Stored in | `fines` | `prediction_history` |
| Effect | Amount owed | Advice only |

Once a return date is known, the fine is pure arithmetic and ML is not needed. This is the reason ML is only used for the future.

## 4.2 Features

Each row describes one loan **as it looked on one day** (the snapshot date).

| Feature | Brief's name | Definition at snapshot date |
|---|---|---|
| `days_remaining` | Days remaining until due date | `due_date - snapshot_date`; negative if overdue |
| `issue_duration_days` | Issue duration | `due_date - issue_date` |
| `prior_late_count` | Previous late-return count | Earlier loans returned after their due date |
| `avg_late_days` | Average late-return days | Mean days late across those late loans; 0 if none |
| `prior_overdue_ratio` | Previous overdue history | `prior_late_count / prior_returned_loans`; 0 if none |
| `category_name` | Book category | One-hot encoded; unknown categories are ignored |
| `borrowing_frequency` | Borrowing frequency | Loans started in the 180 days before the snapshot date |

**Target:** the fine charged at the eventual return, under the rule on that loan.

`prior_overdue_ratio` separates a student with 2 late returns out of 3 from one with 2 out of 40, which the raw count cannot do.

## 4.3 Avoiding data leakage

Leakage means training with information that would not exist at prediction time. It gives impressive test scores and a useless model.

| Risk | Prevention |
|---|---|
| Using the outcome as an input | `return_date`, `late_days` and the fine are never features |
| Student history including the current loan | History counts only loans **returned on or before** the snapshot date, and excludes the current loan |
| Snapshot taken after the book came back | Snapshot dates are drawn only from `issue_date` to `return_date` |
| Future behaviour in the training set | **Time-based split**: train on older loans, test on newer ones |
| A training label from after the cutoff | Training loans must be **returned** before the cutoff, not merely issued before it |
| One loan in both datasets | One snapshot per loan; the split is by loan |
| Preprocessing using test data | Encoder and scaler sit in a scikit-learn `Pipeline`, fitted on training data only |

The same feature code logic must be used for training and live requests, so that live inputs mean what the model learned.

## 4.4 Data

Real history is too small, so a generator will create **synthetic** data:

- Each simulated student gets a hidden lateness tendency, so history really does predict behaviour.
- Return dates are random, influenced by that tendency and the category.
- Fines are calculated with the same formula and sample rules as the real system.
- Size: 500 simulated students, about 20,000 loans, over three years.
- Output: `ml-service/datasets/synthetic_train.csv` and `synthetic_test.csv`, created by the time-based split.

**How synthetic data is identified:** the file names, `data_source = 'SYNTHETIC'` in `prediction_history` and in the metrics, and a visible "trained on sample data" label wherever an estimate appears.

**Honest limitation:** the metrics will show how well the model recovers patterns we built into the generator. They do not prove accuracy for a real library. Good scores on synthetic data should be presented that way in the report and viva.

## 4.5 Training and evaluation

1. Generate data and create the time-based split.
2. Tune Random Forest with cross-validation on the **training set only**, using time-ordered folds.
3. Fit Random Forest and Linear Regression on the training set.
4. Evaluate both once on the test set with MAE, MSE, RMSE and R².
5. Save the pipeline with Joblib, and metrics to `metrics.json` with the model version and data source.

**Why Linear Regression for comparison?** It is the simple baseline. Fines are not linear: most loans have a fine of 0, and the fine starts only after the grace period. Random Forest should handle this better, but the report will state whatever the test results actually show.

## 4.6 Estimates for different return delays

For a chosen delay of N days past the due date, the screen shows two labelled figures:

| Column | Meaning | Source |
|---|---|---|
| Fine if returned that day | Exact, under the loan's rule | Backend `fineService` |
| Expected final fine if still out that day | ML estimate, allowing for further delay | Model, with `days_remaining` set to `-N` |

The rule figure is the correct way to answer "what if I return it then?". Using ML for it would only approximate a known formula. The ML column adds what the formula cannot: how much later this student usually returns once already late.

## 4.7 Post-processing

A Random Forest can output values that break known facts, so the service applies these limits to each estimate:

- Never below 0.
- Never below the fine already accrued on an overdue loan.
- Never above the rule's `max_fine`.

The backend sends these limits with the request. Scenario rows use the accrued fine for their own delay as the lower limit.

## 4.8 Known limitations

- The model learns the fine rates in its training data. **It must be retrained after a fine-rule change.**
- `category_name` is the only way rule differences reach the model, because rates are not on the brief's feature list.
- A new student has no history, so their estimate relies on the loan and category.

## 4.9 Python packages and Smart App Control

Windows Smart App Control blocked the newest builds of pandas, pydantic and scikit-learn on the development PC, so `requirements.txt` pins pandas 2.3.3, pydantic 2.12.5 and scikit-learn 1.8.0, which it allows. Plain `uvicorn` is used because `uvicorn[standard]` needs `websockets`, which had no usable package.

## 4.10 Viva notes

**Why regression, not classification?** The output is an amount in rupees, not a category.

**Why a Random Forest?** It averages many decision trees, which reduces overfitting, and handles non-linear patterns without feature scaling.

**Why not a random train/test split?** It would let the model learn from later loans to predict earlier ones, which can never happen in real use.

**What is the difference between MAE and RMSE?** MAE is the average error in rupees. RMSE squares errors first, so large misses count more.

**What does R² mean?** The share of the variation in fines that the model explains. 1 is perfect; 0 is no better than always guessing the average.

**Why not let ML decide the fine?** A fine is a charge that must be exact, repeatable and explainable, so it has to come from a published rule.
