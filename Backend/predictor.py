"""
predictor.py — Multi-step recursive forecasting for mandi prices.
Updated to work with best_model_trainer.py
"""

import os
import json
import logging
import numpy as np
import pandas as pd
import joblib
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

# ── Compatibility imports from best_model_trainer ──
from model_trainer import BestModelTrainer, build_features, MODELS_DIR

log = logging.getLogger("mandiq.predictor")


def _model_key(commodity: str, market: str) -> str:
    return f"{commodity.lower()}__{market.lower().replace(' ', '_')}"


def _records_to_df(records: List[Dict]) -> pd.DataFrame:
    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    if "modal_price" not in df.columns and "Modal_Price" in df.columns:
        df["modal_price"] = pd.to_numeric(df["Modal_Price"], errors="coerce")
    else:
        df["modal_price"] = pd.to_numeric(df.get("modal_price", None), errors="coerce")
    if "arrival_qty" not in df.columns:
        for alt in ["arrival_qty_mt", "Arrival_Quantity_MT", "arrival_qty"]:
            if alt in df.columns:
                df["arrival_qty"] = pd.to_numeric(df[alt], errors="coerce")
                break
    df = df.dropna(subset=["date", "modal_price"])
    df = df.sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)
    return df


class MandiPredictor:

    def __init__(self):
        self._cache: Dict[str, Any] = {}

    def load_model(self, commodity: str, market: str):
        key = _model_key(commodity, market)
        path = os.path.join(MODELS_DIR, f"{key}.pkl")
        if not os.path.exists(path):
            log.warning(f"Model not found: {path}")
            return
        self._cache[key] = joblib.load(path)
        log.info(f"Loaded model: {key}")

    def is_trained(self, commodity: str, market: str) -> bool:
        key = _model_key(commodity, market)
        if key in self._cache:
            return True
        path = os.path.join(MODELS_DIR, f"{key}.pkl")
        if os.path.exists(path):
            self.load_model(commodity, market)
            return True
        return False

    def list_trained_models(self) -> List[str]:
        return [f.replace(".pkl", "") for f in os.listdir(MODELS_DIR) if f.endswith(".pkl")]

    def get_model_info(self, commodity: str, market: str) -> Optional[Dict]:
        key = _model_key(commodity, market)
        if not self.is_trained(commodity, market):
            return None
        bundle = self._cache[key]
        return {
            "commodity": bundle.get("commodity"),
            "market": bundle.get("market"),
            "metrics": bundle.get("metrics", {}),
            "feature_count": len(bundle.get("feature_cols", [])),
            "models": ["xgb", "lgb", "rf", "et"],
            "importance": bundle.get("importance", {}),
        }

    def predict(self, commodity: str, market: str, historical_data: List[Dict],
                days_ahead: int = 7) -> List[Dict]:
        key = _model_key(commodity, market)
        if not self.is_trained(commodity, market):
            raise ValueError(f"No model for {commodity} @ {market}")

        bundle = self._cache[key]
        feat_cols = bundle["feature_cols"]
        w = bundle.get("weights", {"xgb":0.25,"lgb":0.30,"rf":0.25,"et":0.20})

        hist_df = _records_to_df(historical_data)
        from datetime import date
        today = pd.Timestamp(date.today())
        last_date = max(hist_df["date"].max(), today - pd.Timedelta(days=1))
        working_df = hist_df.copy()
        predictions = []

        # Get Azadpur prices for cross-mandi feature
        az_df = None
        if "Azadpur" not in market:
            az_records = [r for r in historical_data if "azadpur" in str(r.get("market","")).lower()]
            if az_records:
                az_df = _records_to_df(az_records)
                az_df["az_lag1"] = az_df["modal_price"].shift(1)
                az_df = az_df[["date","az_lag1"]]

        for step in range(1, days_ahead + 1):
            next_date = last_date + timedelta(days=step)

            # Add placeholder row
            new_row = pd.DataFrame([{
                "date": next_date,
                "modal_price": np.nan,
                "arrival_qty": working_df["arrival_qty"].tail(7).mean() if "arrival_qty" in working_df.columns else 500.0,
            }])
            extended = pd.concat([working_df, new_row], ignore_index=True)

            # Build features
            try:
                X_all, _, _ = build_features(extended.copy(), az_df)
            except Exception as e:
                log.warning(f"Feature build failed step {step}: {e}")
                break

            if X_all.empty:
                break

            # Get last row (our prediction target)
            row = X_all.iloc[[-1]]
            for c in feat_cols:
                if c not in row.columns:
                    row = row.copy(); row[c] = 0.0
            X_pred = row[feat_cols].fillna(0)

            # Predict with all 4 models
            preds_per_model = []
            for mname, mkey in [("xgb","xgb"),("lgb","lgb"),("rf","rf"),("et","et")]:
                if mkey in bundle:
                    try:
                        p = bundle[mkey].predict(X_pred)[0]
                        preds_per_model.append((mname, max(0, float(p))))
                    except Exception as e:
                        log.warning(f"Model {mname} failed: {e}")

            if not preds_per_model:
                break

            # Weighted average
            weight_map = w
            predicted = sum(weight_map.get(n, 0.25) * p for n, p in preds_per_model)
            spread = float(np.std([p for _, p in preds_per_model]))

            ci_width = max(spread * 1.5, predicted * 0.05)
            lower = max(0, predicted - ci_width)
            upper = predicted + ci_width
            rel_spread = spread / (predicted + 1e-6)
            confidence = round(max(50, 100 - rel_spread * 300), 1)

            predictions.append({
                "date": next_date.strftime("%Y-%m-%d"),
                "predicted_price": round(predicted, 2),
                "lower_bound": round(lower, 2),
                "upper_bound": round(upper, 2),
                "confidence": confidence,
                "unit": "Rs./Quintal",
            })

            # Add prediction back to working history
            working_df = pd.concat([working_df, pd.DataFrame([{
                "date": next_date,
                "modal_price": predicted,
                "arrival_qty": new_row["arrival_qty"].values[0],
            }])], ignore_index=True)

        return predictions


def compute_seasonal(data: List[Dict]) -> Dict:
    df = _records_to_df(data)
    df["month"] = df["date"].dt.month
    df["month_name"] = df["date"].dt.strftime("%b")
    monthly = (df.groupby(["month","month_name"])["modal_price"]
               .agg(avg_price="mean", std_price="std", count="count")
               .reset_index().sort_values("month"))
    best_to_buy  = monthly.nsmallest(3, "avg_price")[["month_name","avg_price"]].to_dict("records")
    best_to_sell = monthly.nlargest(3, "avg_price")[["month_name","avg_price"]].to_dict("records")
    return {
        "monthly_seasonality": [
            {"month": r["month_name"], "avg_price": round(r["avg_price"],2),
             "std_price": round(r["std_price"] if not pd.isna(r["std_price"]) else 0, 2),
             "samples": int(r["count"])}
            for _, r in monthly.iterrows()
        ],
        "best_months_to_buy":  [{"month": r["month_name"], "avg_price": round(r["avg_price"],2)} for r in best_to_buy],
        "best_months_to_sell": [{"month": r["month_name"], "avg_price": round(r["avg_price"],2)} for r in best_to_sell],
    }