"""
predictor.py — Multi-step recursive forecasting for mandi prices.
Sirf Mean Reversion model use karta hai (mandiq_reversion.py) — details
model_trainer.py ke module docstring me hain.
"""

import os
import logging
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import timedelta

from model_trainer import MODELS_DIR
from mandiq_reversion import MandiQReversion

log = logging.getLogger("mandiq.predictor")


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
        self.reversion_model = MandiQReversion()
        self._load_reversion()

    def _load_reversion(self):
        path = os.path.join(MODELS_DIR, "mandiq_reversion.json")
        if os.path.exists(path):
            try:
                self.reversion_model.load(path)
                log.info(f"Loaded global reversion model from {path}")
            except Exception as e:
                log.error(f"Failed to load reversion model from {path}: {e}")
        else:
            log.warning(f"Reversion model parameters not found at {path}")

    def load_model(self, commodity: str, market: str):
        """Backward-compat no-op — reversion params reload hi kaafi hai."""
        self._load_reversion()

    def is_trained(self, commodity: str, market: str) -> bool:
        self._load_reversion()
        rev_key = f"{commodity.lower()}__{market.lower()}"
        return rev_key in self.reversion_model.params

    def list_trained_models(self) -> List[str]:
        return list(self.reversion_model.params.keys())

    def get_model_info(self, commodity: str, market: str) -> Optional[Dict]:
        if not self.is_trained(commodity, market):
            return None
        rev_key = f"{commodity.lower()}__{market.lower()}"
        params = self.reversion_model.params.get(rev_key, {})
        return {
            "commodity": commodity,
            "market": market,
            "model": "reversion",
            "resid_std": params.get("resid_std"),
            "tiers": list(params.get("tiers", {}).keys()),
        }

    def predict(self, commodity: str, market: str, historical_data: List[Dict],
                days_ahead: int = 7, model: str = "reversion") -> Any:
        hist_df = _records_to_df(historical_data)
        recent_prices = hist_df["modal_price"].tail(15).tolist()
        if not recent_prices:
            return {"error": "No historical price records found"}

        from datetime import date
        today = pd.Timestamp(date.today())
        last_date = max(hist_df["date"].max(), today - pd.Timedelta(days=1))

        predictions = []
        current_prices = list(recent_prices)

        for step in range(1, days_ahead + 1):
            next_date = last_date + timedelta(days=step)
            res = self.reversion_model.predict(commodity, market, current_prices)
            if "error" in res:
                if step == 1:
                    return res
                break

            pred_price = res["predicted_price"]
            current_prices.append(pred_price)
            if len(current_prices) > 15:
                current_prices.pop(0)

            predictions.append({
                "date": next_date.strftime("%Y-%m-%d"),
                "predicted_price": res["predicted_price"],
                "lower_bound": res["price_low"],
                "upper_bound": res["price_high"],
                "direction": res["direction"],
                "signal": res["signal"],
                "confidence": res["expected_accuracy_pct"] or 58,
                "message": res["message"],
                "unit": "Rs./Quintal"
            })

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