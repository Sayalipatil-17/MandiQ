"""
honest_eval.py -- the truth-teller. Evaluate ANY next-day price predictor against
the naive benchmark on a locked test window, with the metrics that actually matter.

Run this on BOTH your ensemble and the reversion model. It reports:
  * MAPE on all days AND on move days (naive is unbeatable on flat days, so the
    move-day number is the honest one)
  * Directional accuracy on move days, with a SHUFFLE control (must be ~50%)
This is how you prove - in your own pipeline - which model is actually better,
and it is exactly the discipline that stops leakage-inflated results.

predict_fn(commodity, market, price_history_list) -> predicted_price (float)
"""

import numpy as np
import pandas as pd

PRICE_COL = "modal_price"; DATE_COL = "date"; COMMODITY = "commodity"; MARKET = "market"


def evaluate(df, predict_fn, test_frac=0.30, label="model"):
    df = df.copy(); df[DATE_COL] = pd.to_datetime(df[DATE_COL])
    rows = []
    for (com, mkt), g in df.groupby([COMMODITY, MARKET]):
        g = g.sort_values(DATE_COL).drop_duplicates(DATE_COL)
        prices = pd.to_numeric(g[PRICE_COL], errors="coerce").values
        n = len(prices)
        if n < 400:
            continue
        split = int(n * (1 - test_frac))
        for t in range(max(split, 4), n - 1):
            actual = prices[t + 1]
            if actual <= 0 or np.isnan(actual):
                continue
            try:
                pred = float(predict_fn(com, mkt, list(prices[:t + 1])))
            except Exception:
                pred = prices[t]
            rows.append({"com": com, "moved": abs(actual - prices[t]) / prices[t] > 0.001,
                         "model_e": abs(actual - pred) / actual * 100,
                         "naive_e": abs(actual - prices[t]) / actual * 100,
                         "act_dir": np.sign(actual - prices[t]),
                         "pred_dir": np.sign(pred - prices[t])})
    r = pd.DataFrame(rows); mv = r[r.moved]
    k = mv[mv.pred_dir != 0]
    dir_acc = (k.pred_dir == k.act_dir).mean() * 100 if len(k) else float("nan")
    # shuffle control
    rng = np.random.RandomState(0); sh = rng.permutation(mv.act_dir.values)
    sh_acc = (mv.pred_dir.values[mv.pred_dir.values != 0] ==
              sh[mv.pred_dir.values != 0]).mean() * 100 if (mv.pred_dir != 0).any() else float("nan")
    print(f"\n=== {label} vs naive ({len(r)} predictions) ===")
    print(f"  MAPE all days : {label} {r.model_e.mean():.2f}%   naive {r.naive_e.mean():.2f}%")
    print(f"  MAPE move days: {label} {mv.model_e.mean():.2f}%   naive {mv.naive_e.mean():.2f}%   "
          f"({mv.model_e.mean()-mv.naive_e.mean():+.2f}pp)")
    print(f"  Direction (move): {dir_acc:.1f}%   shuffle control {sh_acc:.1f}% (should be ~50)")
    return {"mape_all": r.model_e.mean(), "mape_move": mv.model_e.mean(),
            "naive_move": mv.naive_e.mean(), "dir": dir_acc, "shuffle": sh_acc}
