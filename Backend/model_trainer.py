"""
model_trainer.py — MandiQ Model Trainer
=========================================
Sirf Mean Reversion model train karta hai (mandiq_reversion.py).

Pehle yahan ek 4-model ensemble (XGBoost + LightGBM + RandomForest + ExtraTrees)
bhi tha, lekin held-out evaluation me reversion model ne har commodity/metric pe
ensemble ko beat kiya (ensemble all-day MAPE ~14.5% vs reversion ~7.3%) — isliye
ensemble hata diya gaya hai. Details: mandiq_reversion.py ka module docstring.
"""

import os
import logging
import pandas as pd
from typing import List, Dict, Optional, Any

from mandiq_reversion import MandiQReversion

log = logging.getLogger("mandiq.trainer")
MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)


def safe_format(value, decimals=2):
    try:
        return round(float(value), decimals)
    except Exception:
        return value


class MandiModelTrainer:
    """Reversion model trainer — global (saare commodities/markets ek hi params file me)."""

    def __init__(self, models_dir: str = MODELS_DIR):
        self.models_dir = models_dir
        os.makedirs(models_dir, exist_ok=True)

    def train_reversion(self, db) -> Optional[MandiQReversion]:
        """Sabhi commodities/markets ke chronological pehle 70% record par
        reversion model fit karta hai (held-out 30% honest_eval/testing ke liye)."""
        records = db.get_all_price_records()
        if not records:
            log.warning("No records in DB to train reversion model.")
            return None
        df = pd.DataFrame(records)
        df["date"] = pd.to_datetime(df["date"])

        train_dfs = []
        for (com, mkt), g in df.groupby(["commodity", "market"]):
            g = g.sort_values("date").drop_duplicates("date")
            split = int(len(g) * 0.70)
            train_dfs.append(g.iloc[:split])

        if not train_dfs:
            return None

        df_train = pd.concat(train_dfs, ignore_index=True)
        reversion_model = MandiQReversion()
        reversion_model.fit(df_train)

        path = os.path.join(self.models_dir, "mandiq_reversion.json")
        reversion_model.save(path)
        log.info(f"Successfully trained and saved reversion model to {path}")
        return reversion_model

    def train(self, records: List[Dict], commodity: str, market: str, model_type: str = "reversion") -> Dict:
        """Ek commodity/market ke liye train call aata hai, lekin reversion model
        global hai — isliye poori DB se retrain karte hain aur is commodity/market
        ke stats wapas karte hain."""
        df = pd.DataFrame(records)
        df["date"] = pd.to_datetime(df["date"])
        df["modal_price"] = pd.to_numeric(df.get("modal_price"), errors="coerce")
        df = df.dropna(subset=["date", "modal_price"]).sort_values("date")

        if len(df) < 60:
            log.warning(f"{commodity} @ {market}: only {len(df)} rows, need 60+")
            return {"error": "insufficient_data", "rows": len(df)}

        from database import MandiDB
        db_conn = MandiDB()
        self.train_reversion(db_conn)

        # Honest held-out evaluation for this commodity/market
        metrics = {"rows": len(df), "commodity": commodity, "market": market}
        try:
            import honest_eval
            reversion_model = MandiQReversion()
            reversion_model.load(os.path.join(self.models_dir, "mandiq_reversion.json"))

            def reversion_predict_fn(com, mkt, price_history):
                res = reversion_model.predict(com, mkt, price_history)
                return price_history[-1] if "error" in res else res["predicted_price"]

            metrics["honest_eval"] = honest_eval.evaluate(df, reversion_predict_fn, test_frac=0.30, label="reversion")
        except Exception as e:
            log.error(f"Honest eval for reversion failed: {e}")

        return metrics

    def predict(self, records: List[Dict], commodity: str, market: str, n_days: int = 7) -> List[Dict]:
        """Backward-compat helper — asli prediction predictor.py se hoti hai."""
        raise NotImplementedError("Use MandiPredictor.predict() for forecasts.")


if __name__ == "__main__":
    print("MandiModelTrainer ready. Import and use:")
    print("  from model_trainer import MandiModelTrainer")
    print("  trainer = MandiModelTrainer()")
    print("  metrics = trainer.train(records, 'Tomato', 'Azadpur APMC')")
