"""
experiment_trainer.py
Tumhare model_trainer.py ka experiment version — CONFIG toggle karke
results compare karo, best config phir main code mein merge karo.

3 changes test ho rahe hain:
1. MARKET filter (multi-market CSV mein lag features galat ban rahe the)
2. NaN warm-up rows: drop vs fillna(0)
3. producing_region: one-hot vs ordinal encoding
4. Ensemble: weighted (better model zyada weight) vs simple average
"""

import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
from sklearn.model_selection import TimeSeriesSplit

# ---------- CONFIG: yahan change karke experiment karo ----------
CSV_PATH = CSV_PATH = r"C:\naman_sharma_cse_b\MandiQ_app\Backend\uploads\Tomato_Clean_data.csv"
MARKET = "Azadpur APMC"        # ek market select karo
USE_ONEHOT_REGION = True       # False = purani ordinal encoding
DROP_NAN_WARMUP = True         # False = purana fillna(0) behaviour
USE_WEIGHTED_ENSEMBLE = False   # False = simple average
N_SPLITS = 5
# ------------------------------------------------------------------


def season(m):
    if m in [12, 1, 2]: return 1
    if m in [3, 4, 5]: return 2
    if m in [6, 7, 8, 9]: return 3
    return 4


def build_features(df):
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").set_index("date")

    df["month"] = df.index.month
    df["day_of_week"] = df.index.dayofweek
    df["day_of_year"] = df.index.dayofyear
    df["quarter"] = df.index.quarter
    df["is_weekend"] = (df.index.dayofweek >= 5).astype(int)
    df["season"] = df["month"].apply(season)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

    price = df["modal_price_rs_quintal"] if "modal_price_rs_quintal" in df.columns else df["modal_price"]
    for lag in [1, 2, 3, 5, 7, 14, 21, 30]:
        df[f"price_lag_{lag}"] = price.shift(lag)

    for w in [7, 14, 30, 60, 90]:
        r = price.shift(1).rolling(w, min_periods=max(3, w // 4))
        df[f"roll_mean_{w}"] = r.mean()
        df[f"roll_std_{w}"] = r.std()

    df["price_change_7d"] = price.pct_change(7).shift(1)
    df["price_change_30d"] = price.pct_change(30).shift(1)

    if "arrival_qty_mt" in df.columns:
        df["arrival_lag_1"] = df["arrival_qty_mt"].shift(1)
        df["arrival_roll_7"] = df["arrival_qty_mt"].shift(1).rolling(7, min_periods=2).mean()

    weather_cols = ['delhi_temp_max', 'delhi_temp_min', 'delhi_rainfall', 'delhi_humidity',
                    'region_temp_max', 'region_temp_min', 'region_rainfall', 'region_humidity']
    for c in weather_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    if "producing_region" in df.columns:
        if USE_ONEHOT_REGION:
            df = pd.get_dummies(df, columns=["producing_region"], prefix="region")
        else:
            df["producing_region_enc"] = df["producing_region"].map(
                {"agra": 0, "kolar": 1, "solan": 2}).fillna(0)

    df["target"] = price
    return df


def get_feature_cols(df):
    exclude = {"modal_price", "modal_price_rs_quintal", "target", "market", "arrival_qty_mt"}
    return [c for c in df.columns if c not in exclude and pd.api.types.is_numeric_dtype(df[c])]


def mape(y_true, y_pred):
    y_true, y_pred = np.array(y_true, float), np.array(y_pred, float)
    mask = y_true != 0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def run_fold(Xtr, ytr, Xval, yval):
    xgb_m = xgb.XGBRegressor(n_estimators=500, learning_rate=0.03, max_depth=6,
                              subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=0)
    xgb_m.fit(Xtr, ytr)
    p_xgb = xgb_m.predict(Xval)

    lgb_m = lgb.LGBMRegressor(n_estimators=500, learning_rate=0.03, max_depth=7,
                               subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=-1)
    lgb_m.fit(Xtr, ytr)
    p_lgb = lgb_m.predict(Xval)

    if USE_WEIGHTED_ENSEMBLE:
        e_xgb, e_lgb = mape(yval, p_xgb), mape(yval, p_lgb)
        w_xgb, w_lgb = 1 / (e_xgb + 1e-6), 1 / (e_lgb + 1e-6)
        pred = (p_xgb * w_xgb + p_lgb * w_lgb) / (w_xgb + w_lgb)
    else:
        pred = (p_xgb + p_lgb) / 2

    return mape(yval, pred)


def main():
    df = pd.read_csv(CSV_PATH)
    if "market" in df.columns:
        df = df[df["market"] == MARKET].copy()

    df = build_features(df)
    df = df.dropna(subset=["target"])
    feat_cols = get_feature_cols(df)

    if DROP_NAN_WARMUP:
        df = df.dropna(subset=feat_cols)
    else:
        df[feat_cols] = df[feat_cols].fillna(0)

    X, y = df[feat_cols], df["target"].astype(float)
    print(f"Market: {MARKET} | Rows used: {len(X)} | Features: {len(feat_cols)}")

    tscv = TimeSeriesSplit(n_splits=N_SPLITS, test_size=max(10, len(X) // 10))
    scores = []
    for fold, (tr_idx, val_idx) in enumerate(tscv.split(X), 1):
        m = run_fold(X.iloc[tr_idx], y.iloc[tr_idx], X.iloc[val_idx], y.iloc[val_idx])
        scores.append(m)
        print(f"Fold {fold}: MAPE = {m:.2f}%")

    print(f"\nAverage CV MAPE: {np.mean(scores):.2f}%")


if __name__ == "__main__":
    main()