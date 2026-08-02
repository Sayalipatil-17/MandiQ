# MandiQ Machine Learning Model Documentation (MODEL_README) 🌾

This document provides a highly detailed, deep-dive guide to the machine learning architecture, feature engineering formulas, training pipeline, database dependencies, and prediction mechanism of MandiQ. Use this document as a developer reference to customize and improve the forecasting pipeline.

---

## Table of Contents
1. [System Architecture & Data Flow](#1-system-architecture--data-flow)
2. [Database Schema & Data Models](#2-database-schema--data-models)
3. [Deep Feature Engineering (Formulas & Logic)](#3-deep-feature-engineering-formulas--logic)
4. [The 4-Model Ensemble Architecture](#4-the-4-model-ensemble-architecture)
5. [TimeSeries Validation & Training Pipeline](#5-timeseries-validation--training-pipeline)
6. [Recursive Multi-Step Prediction Algorithm](#6-recursive-multi-step-prediction-algorithm)
7. [Developer Modification Guide (Code Recipes)](#7-developer-modification-guide-code-recipes)

---

## 1. System Architecture & Data Flow

MandiQ is built to ingest daily market reports (PDF/CSV) from Agmarknet, augment them with historical local and region-specific weather data, persist them in a structured SQLite database, and run automated machine learning training and multi-step forecasting.

```
+───────────────────────────+
| Agmarknet Reports (PDF/CSV)│
+─────────────┬─────────────+
              │
              ▼
+───────────────────────────+
|   pdf_parser/csv_parser   |
+─────────────┬─────────────+
              │ (Daily crop price & arrivals)
              ▼
+───────────────────────────+       +───────────────────────────+
|   Open-Meteo Archive API  |<─────>|    delhi/region weather   |
+─────────────┬─────────────+       |   lags (e.g. 4-6 days)    |
              │ (Delhi & producing region)
              ▼
+───────────────────────────+
| sqlite3 DB (price_records)│
+─────────────┬─────────────+
              │ (Historical Records)
              ▼
+───────────────────────────+
| model_trainer.py (Train)  |
+─────────────┬─────────────+
              │ (Saves bundle dict)
              ▼
+───────────────────────────+
|  models/<commodity>.pkl   |
+─────────────┬─────────────+
              │ (Inference / Predict)
              ▼
+───────────────────────────+
|   predictor.py (Forecast) |
+───────────────────────────+
```

---

## 2. Database Schema & Data Models

All historical price and weather data are managed by [database.py](file:///c:/Users/RISHABH%20JAISWAL/Downloads/MandiQ-main/MandiQ-main/Backend/database.py) using SQLite.

### A. Table: `price_records`
Stores the daily records parsed from PDF/CSV, merged with meteorological metrics.

| Column | SQLite Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Auto-incremented primary key. |
| `state` | `TEXT` | State of the Mandi (e.g., Delhi). |
| `district` | `TEXT` | District of the Mandi. |
| `market` | `TEXT NOT NULL` | APMC Market name (e.g., `Azadpur APMC`). |
| `commodity_grp` | `TEXT` | Broad category (e.g., vegetables). |
| `commodity` | `TEXT NOT NULL` | Target commodity name (e.g., `Tomato`, `Onion`). |
| `date` | `TEXT NOT NULL` | Date in ISO-8601 (`YYYY-MM-DD`). |
| `arrival_qty` | `REAL` | Quantity arrived at mandi (Metric Tons). |
| `arrival_unit` | `TEXT` | Unit of arrival (typically tonnes). |
| `modal_price` | `REAL NOT NULL` | The modal market clearing price (Rs./Quintal). |
| `price_unit` | `TEXT` | Unit of pricing. |
| `producing_region` | `TEXT` | Sourcing region derived from crop month. |
| `delhi_temp_max` | `REAL` | Maximum daily temperature in Delhi (°C). |
| `delhi_temp_min` | `REAL` | Minimum daily temperature in Delhi (°C). |
| `delhi_rainfall` | `REAL` | Total daily precipitation in Delhi (mm). |
| `delhi_humidity` | `REAL` | Mean relative humidity in Delhi (%). |
| `region_temp_max` | `REAL` | Sourcing region max daily temperature. |
| `region_temp_min` | `REAL` | Sourcing region min daily temperature. |
| `region_rainfall` | `REAL` | Sourcing region total daily rainfall. |
| `region_humidity` | `REAL` | Sourcing region mean daily humidity. |

**Constraints & Indexes:**
* **Unique Key**: `UNIQUE(commodity, market, date)` prevents duplicate entries for the same crop and market on the same day.
* **Indexes**: 
  * `idx_comm_market` on `(commodity, market)` speed up filtering during data lookup.
  * `idx_date` on `(date)` speed up chronological lookups.

### B. Table: `training_jobs`
Tracks training execution progress, evaluation metrics, and error logs.

* `model_key`: `TEXT PRIMARY KEY` (Format: `{commodity}::{market}`)
* `status`: `TEXT NOT NULL` (States: `queued`, `training`, `done`, `failed`)
* `metrics`: `TEXT` (JSON string containing Hold-out and CV scores)
* `error`: `TEXT` (Holds traceback description if status is `failed`)
* `updated_at`: `TEXT` (Timestamp)

---

## 3. Deep Feature Engineering (Formulas & Logic)

The feature matrix is built in `model_trainer.py` -> `build_features()`. Given a price series $P$ sorted chronologically by index $t$:

### A. Autoregressive Lags (8 Features)
Lags capture short-term memory and autocorrelation structures:
$$\text{Lag}_k(t) = P_{t-k} \quad \text{for } k \in \{1, 2, 3, 5, 7, 14, 21, 30\}$$
* *Why it matters:* Mandi prices exhibit strong path dependency; yesterday's price is often the strongest predictor for today's price.

### B. Rolling Windows (8 Features)
Provides smoothing and volatility measurements:
* **Rolling Mean**:
  $$\text{RollingMean}_w(t) = \frac{1}{w}\sum_{i=1}^{w} P_{t-i} \quad \text{for } w \in \{7, 14, 30, 60\}$$
* **Rolling Standard Deviation**:
  $$\text{RollingStd}_w(t) = \sqrt{\frac{1}{w-1}\sum_{i=1}^{w} (P_{t-i} - \text{RollingMean}_w(t))^2} \quad \text{for } w \in \{7, 14, 30, 60\}$$
  *(Computed with `min_periods=3` so that early records in the series don't result in NaN).*

### C. Momentum Features (4 Features)
Indicates velocity of price movements:
* **1-Day Difference**: $\text{mom1}(t) = P_{t-1} - P_{t-2}$
* **7-Day Difference**: $\text{mom7}(t) = P_{t-1} - P_{t-8}$
* **7-Day Percentage Change**: $\text{pct7}(t) = \frac{P_{t-1} - P_{t-8}}{P_{t-8}}$
* **30-Day Percentage Change**: $\text{pct30}(t) = \frac{P_{t-1} - P_{t-31}}{P_{t-31}}$

### D. Trend Ratios & Relative Distance (3 Features)
Measures moving average crossovers and outlier distance:
* **Short-to-Medium Ratio**: $\text{t730}(t) = \frac{\text{RollingMean}_7(t)}{\text{RollingMean}_{30}(t) + 10^{-6}}$
* **Medium-to-Long Ratio**: $\text{t1460}(t) = \frac{\text{RollingMean}_{14}(t)}{\text{RollingMean}_{60}(t) + 10^{-6}}$
* **Z-score (60-day)**: $\text{zscore}(t) = \frac{P_{t-1} - \text{RollingMean}_{60}(t)}{\text{RollingStd}_{60}(t) + 10^{-6}}$
  *(Indicates whether yesterday's price is historically overbought or oversold).*

### E. Cyclic Calendar Transformations (6 Features)
Encodes cyclic dates into two-dimensional space to represent smooth seasonal boundaries:
* **Cyclic Month**:
  $$\text{ms}(t) = \sin\left(\frac{2 \pi \cdot \text{month}(t)}{12}\right), \quad \text{mc}(t) = \cos\left(\frac{2 \pi \cdot \text{month}(t)}{12}\right)$$
* **Cyclic Day of Year**:
  $$\text{ds}(t) = \sin\left(\frac{2 \pi \cdot \text{dayofyear}(t)}{365}\right), \quad \text{dc}(t) = \cos\left(\frac{2 \pi \cdot \text{dayofyear}(t)}{365}\right)$$
* **Week of Year**: $\text{woy}(t) \in [1, 53]$
* **Seasons Mapping (Indian Crop Cycle)**:
  $$\text{season}(t) = \begin{cases} 
  1 & \text{if Month} \in \{12, 1, 2, 3\} \text{ (Winter)} \\
  2 & \text{if Month} \in \{4, 5\} \text{ (Summer)} \\
  3 & \text{if Month} \in \{6, 7, 8, 9\} \text{ (Monsoon)} \\
  4 & \text{if Month} \in \{10, 11\} \text{ (Post-Monsoon)} 
  \end{cases}$$

### F. Supply/Arrival Features (6 Features)
Incorporates volume dynamics. Given arrival volume $A_t$:
* **Lags**: $\text{al1}(t) = A_{t-1}$, $\text{al7}(t) = A_{t-7}$
* **Rolling Mean Volume**: $\text{arm7}(t) = \text{Mean}(A_{t-1}..A_{t-7})$, $\text{arm30}(t) = \text{Mean}(A_{t-1}..A_{t-30})$
* **Price-to-Arrival Ratio**: $\text{par}(t) = \frac{\text{RollingMean}_7(t)}{\text{arm7}(t) + 10^{-6}}$
* **Log Arrival Volume**: $\text{log\_arr}(t) = \ln(A_{t-1} + 1)$

### G. Cross-Mandi Interaction (1 Feature)
Secondary markets (Shahdara & Keshopur) look at primary markets (Azadpur) to track correlation:
* `az_lag1`: The 1-day lagged price of the commodity in Azadpur APMC.

### H. Meteorological Features (8 Features)
Weather affects crop arrivals and logistics:
* **Delhi Weather**: Temperature Max/Min, Rainfall, Humidity.
* **Lagged Producing Region Weather**: Sourced weather from regions (Agra, Solan, Kolar, Nashik) mapped dynamically to the month of the crop and shifted by crop-specific harvest lags:
  $$\text{HarvestLag} = \begin{cases} 4 \text{ days} & \text{for Tomato} \\ 6 \text{ days} & \text{for Potato} \\ 6 \text{ days} & \text{for Onion} \\ 1 \text{ day} & \text{for Spinach} \end{cases}$$

---

## 4. The 4-Model Ensemble Architecture

The final price prediction is computed as a weighted sum of four regressors:

### A. Hyperparameter Specifications
```python
# 1. XGBoost
XGB_PARAMS = {
    'n_estimators': 400,
    'learning_rate': 0.03,
    'max_depth': 4,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'min_child_weight': 3,
    'random_state': 42
}

# 2. LightGBM
LGB_PARAMS = {
    'n_estimators': 400,
    'learning_rate': 0.03,
    'num_leaves': 31,
    'min_child_samples': 10,
    'random_state': 42
}

# 3. Random Forest (Bagging)
RF_PARAMS = {
    'n_estimators': 200,
    'min_samples_leaf': 1,
    'max_features': 'sqrt',
    'random_state': 42,
    'n_jobs': -1
}

# 4. Extra Trees (Extremely Randomized Trees)
ET_PARAMS = {
    'n_estimators': 150,
    'min_samples_leaf': 2,
    'random_state': 42,
    'n_jobs': -1
}
```

### B. Why this Combination?
* **Bias-Variance Balance**: XGBoost and LightGBM minimize bias through iterative boosting, while RF and Extra Trees minimize variance through bagging.
* **Overfitting Prevention**: Mandi price records are often noisy and short. By forcing XGBoost to a shallow `max_depth=4` and using sub-sampling, we prevent the gradient boosted trees from learning spurious noise.
* **Weights Assignment**: Random Forest and Extra Trees are weighted highly (`0.40` each) because they generalize better on sparse features and are less sensitive to out-of-distribution values compared to gradient boosted trees.

---

## 5. TimeSeries Validation & Training Pipeline

Random K-Fold cross validation cannot be used on time-series data because it leaks future values into past predictions. MandiQ uses **TimeSeriesSplit** validation:

### A. Walk-Forward Validation (5-Fold)
```
Split 1: [Train: Fold 1] ─────────────> [Test: Fold 2]
Split 2: [Train: Fold 1 + 2] ─────────> [Test: Fold 3]
Split 3: [Train: Fold 1 + 2 + 3] ─────> [Test: Fold 4]
Split 4: [Train: Fold 1 + 2 + 3 + 4] ─> [Test: Fold 5]
```

### B. Early Stopping Strategy
During the final fit:
* 90% of the dataset is used for training.
* The remaining 10% (the most recent period) acts as the holdout validation set.
* For **XGBoost** and **LightGBM**, early stopping is initialized with `early_stopping_rounds=40`. Training halts if validation performance does not improve for 40 consecutive iterations, saving computational overhead and preventing overfitting.

### C. Metric: MAPE
The models are evaluated using the MAPE score:
$$\text{MAPE} = \frac{100\%}{n} \sum_{t=1}^{n} \left| \frac{y_t - \hat{y}_t}{y_t} \right|$$

---

## 6. Recursive Multi-Step Prediction Algorithm

When forecasting $D$ days ahead, we do not have actual prices for days $t+1, t+2, ...$. The prediction model uses a recursive loop:

```python
# Pseudo-implementation from predictor.py
working_df = historical_data.copy()

for step in range(1, days_ahead + 1):
    next_date = last_date + timedelta(days=step)
    
    # 1. Append a dummy placeholder row with average arrival volumes
    new_row = {
        "date": next_date,
        "modal_price": np.nan, 
        "arrival_qty": working_df["arrival_qty"].tail(7).mean()
    }
    extended = concat([working_df, new_row])
    
    # 2. Rebuild the entire feature matrix
    X_features, _, _ = build_features(extended)
    
    # 3. Extract the features of the last row (our prediction target)
    X_pred = X_features.iloc[[-1]][feature_columns]
    
    # 4. Infer with the ensemble
    p_xgb = xgb_model.predict(X_pred)[0]
    p_lgb = lgb_model.predict(X_pred)[0]
    p_rf  = rf_model.predict(X_pred)[0]
    p_et  = et_model.predict(X_pred)[0]
    
    predicted_price = (W_XGB * p_xgb) + (W_LGB * p_lgb) + (W_RF * p_rf) + (W_ET * p_et)
    
    # 5. Overwrite the NaN modal_price in the last row with the predicted price
    working_df.loc[working_df["date"] == next_date, "modal_price"] = predicted_price
```

### Uncertainty / Spread Estimation
For each step, we calculate the standard deviation (spread) of predictions across the ensemble:
$$\text{Spread} = \text{std}([p_{XGB}, p_{LGB}, p_{RF}, p_{ET}])$$
$$\text{Confidence} = 100 - \left( \frac{\text{Spread}}{\text{PredictedPrice}} \times 300 \right)$$
* As the predictions project further into the future, the individual models diverge, increasing the `Spread`, widening the bounds (`lower_bound` / `upper_bound`), and reducing the confidence score.

---

## 7. Developer Modification Guide (Code Recipes)

### Recipe A: Adding a 10-day Simple Moving Average (SMA)
To add a new feature to the model, update `build_features` in `model_trainer.py`:

```python
# Open model_trainer.py -> find build_features() function
# Add the following around line 79:

    # Calculate 10-day rolling mean of historical prices
    r10 = p.shift(1).rolling(10, min_periods=3)
    d['rm10'] = r10.mean()
    
# The model trainer automatically includes all new numeric columns 
# in 'feat_cols' unless they are explicitly blacklisted in 'excl'.
```

### Recipe B: Adjusting Ensemble Weights
If XGBoost performance is better during experiments, adjust weights in `model_trainer.py` (lines 38-42):

```python
# Old Weights:
# W_XGB = 0.10, W_LGB = 0.10, W_RF = 0.40, W_ET = 0.40

# New Weights (Increasing Boosting weight):
W_XGB = 0.30  # Increased XGBoost influence
W_LGB = 0.20  # Increased LightGBM influence
W_RF  = 0.25  # Lowered bagging
W_ET  = 0.25  # Lowered bagging

# IMPORTANT: Ensure the total sum is 1.0 (0.3 + 0.2 + 0.25 + 0.25 = 1.0)
```

### Recipe C: Modifying Time Series Split Folds
To validate using 10 folds instead of 5, edit the trainer class in `model_trainer.py` (line 200):

```python
# Old code:
# tscv = TimeSeriesSplit(n_splits=5)

# New code:
tscv = TimeSeriesSplit(n_splits=10)
```

### Recipe D: Overriding Early Stopping Iterations
If you want to train longer before halting when validation plateauing occurs, change the callbacks in `model_trainer.py` (lines 223-231):

```python
# Old: early_stopping_rounds=40
# Change to:
xm_f = xgb.XGBRegressor(**XGB_PARAMS, early_stopping_rounds=80)

# In lightgbm fit callback:
lm_f.fit(Xtr, ytr, eval_set=[(Xes, yes_)],
         callbacks=[lgb.early_stopping(80, verbose=False)])
```
