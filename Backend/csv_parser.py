"""
csv_parser.py — Parse MandiQ master CSV (any crop) into records.
Same output format as pdf_parser.

Commodity detection order:
  1. 'commodity' column in the CSV (if present)
  2. crop name found in the filename (tomato/potato/onion/spinach/...)
  3. fallback default "Tomato"
"""

import os
import pandas as pd
import logging
from typing import List, Dict, Any

log = logging.getLogger("mandiq.csv_parser")

# known crops we can detect from filenames
KNOWN_CROPS = ["tomato", "potato", "onion", "spinach", "cauliflower", "cabbage", "wheat", "rice"]


def _detect_commodity(csv_path: str, df: pd.DataFrame) -> str:
    # 1) explicit column wins
    if "commodity" in df.columns:
        val = str(df["commodity"].dropna().iloc[0]).strip() if df["commodity"].notna().any() else ""
        if val:
            return val.title()

    # 2) filename hint
    name = os.path.basename(csv_path).lower()
    for crop in KNOWN_CROPS:
        if crop in name:
            return crop.title()

    # 3) fallback
    return "Tomato"


def parse_mandi_csv(csv_path: str) -> List[Dict[str, Any]]:
    """
    Parse MandiQ CSV and return records in same format as pdf_parser.
    Works for any crop as long as the columns match the master format.
    """
    log.info(f"Parsing CSV: {csv_path}")

    df = pd.read_csv(csv_path, parse_dates=["date"])
    df = df.dropna(subset=["date", "modal_price_rs_quintal"])

    commodity = _detect_commodity(csv_path, df)
    log.info(f"Detected commodity: {commodity}")

    records = []
    for _, row in df.iterrows():
        # allow per-row commodity if column exists, else use detected
        row_commodity = str(row["commodity"]).strip().title() if "commodity" in df.columns and pd.notna(row.get("commodity")) else commodity

        records.append({
            "state":            "NCT of Delhi",
            "district":         "Delhi",
            "market":           row["market"],
            "group":            "Vegetables",
            "commodity":        row_commodity,
            "date":             pd.to_datetime(row["date"]).strftime("%Y-%m-%d"),
            "arrival_qty":      row.get("arrival_qty_mt"),
            "arrival_unit":     "Metric Tonnes",
            "modal_price":      row["modal_price_rs_quintal"],
            "price_unit":       "Rs./Quintal",
            # Weather features
            "producing_region": row.get("producing_region"),
            "delhi_temp_max":   row.get("delhi_temp_max"),
            "delhi_temp_min":   row.get("delhi_temp_min"),
            "delhi_rainfall":   row.get("delhi_rainfall"),
            "delhi_humidity":   row.get("delhi_humidity"),
            "region_temp_max":  row.get("region_temp_max"),
            "region_temp_min":  row.get("region_temp_min"),
            "region_rainfall":  row.get("region_rainfall"),
            "region_humidity":  row.get("region_humidity"),
        })

    log.info(f"Total records parsed: {len(records)} | commodity={commodity}")
    return records