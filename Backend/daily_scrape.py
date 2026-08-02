"""
daily_scrape.py — Sirf aaj ka mandi data scrape karo, train mat karo.
Har roz subah 6 AM cron se chalta hai.

Manual run:
    python daily_scrape.py
"""

import os, sys, time, logging, datetime as dt
import requests as req
import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
log = logging.getLogger("daily_scrape")

API_URL = "https://api.agmarknet.gov.in/v1/daily-price-arrival/report"
API_HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0",
}

CROPS = {"Tomato": "65", "Potato": "24", "Onion": "23", "Spinach": "290"}
DELHI_MARKETS = {
    "azadpur": "Azadpur APMC",
    "keshopur": "Keshopur APMC",
    "shahdara": "Shahdara APMC",
}

SEASON_MAP = {
    12: "winter", 1: "winter", 2: "winter",
    3: "summer", 4: "summer", 5: "summer",
    6: "monsoon", 7: "monsoon", 8: "monsoon", 9: "monsoon",
    10: "post_monsoon", 11: "post_monsoon"
}

PRODUCING_REGION = {
    "Tomato": {1:"agra",2:"agra",3:"kolar",4:"kolar",5:"kolar",6:"solan",7:"solan",8:"solan",9:"solan",10:"agra",11:"agra",12:"agra"},
    "Potato": {1:"agra",2:"agra",3:"agra",4:"agra",5:"agra",6:"solan",7:"solan",8:"solan",9:"agra",10:"agra",11:"agra",12:"agra"},
    "Onion":  {m:"nashik" for m in range(1,13)},
    "Spinach": {1:"agra",2:"agra",3:"agra",4:"solan",5:"solan",6:"solan",7:"agra",8:"agra",9:"agra",10:"agra",11:"agra",12:"agra"},
}

DATA_DIR = "data"


def scrape_today(crop: str, commodity_id: str, date_str: str) -> pd.DataFrame:
    log.info(f"[{crop}] Scraping {date_str}...")
    body = {
        "data_type": "100006", "commodity": commodity_id, "group": "6",
        "state": "[25]", "district": "[100001]", "variety": "[100007]",
        "grade": "[100003]", "market": "[100002]",
        "from_date": date_str, "to_date": date_str, "page": "1", "limit": "50",
    }
    try:
        r = req.post(API_URL, json=body, headers=API_HEADERS, timeout=90)
        js = r.json()
    except Exception as e:
        log.error(f"  Fetch error: {e}")
        return pd.DataFrame()

    if not js.get("status"):
        log.warning(f"  API error: {js.get('message','unknown')}")
        return pd.DataFrame()

    all_rows = []
    for rec in js.get("data", {}).get("records", []):
        all_rows.extend(rec.get("data", []))

    if not all_rows:
        log.info(f"  No data for {crop} on {date_str} (mandi may be closed)")
        return pd.DataFrame()

    pnum = lambda x: pd.to_numeric(str(x).replace(",", ""), errors="coerce")
    raw = pd.DataFrame(all_rows)
    df = pd.DataFrame({
        "date": pd.to_datetime(raw["arrival_date"], dayfirst=True, errors="coerce"),
        "market": raw["market_name"].map(
            lambda m: next((v for k, v in DELHI_MARKETS.items() if k in str(m).lower()), None)
        ),
        "arrival_qty_mt": raw["arrival_qty"].map(pnum),
        "modal_price_rs_quintal": raw["model_price"].map(pnum),
    }).dropna(subset=["market", "date", "modal_price_rs_quintal"]).reset_index(drop=True)

    log.info(f"  {len(df)} rows | markets: {sorted(df['market'].unique())}")
    return df


def insert_to_db(df: pd.DataFrame, crop: str):
    """DB mein insert karo bina training ke."""
    sys.path.insert(0, os.path.dirname(__file__))
    from database import MandiDB
    db = MandiDB()

    records = []
    for _, row in df.iterrows():
        month = row["date"].month
        rec = {
            "date": str(row["date"].date()),
            "commodity": crop,
            "market": row["market"],
            "modal_price": float(row["modal_price_rs_quintal"]) if pd.notna(row["modal_price_rs_quintal"]) else None,
            "arrival_qty": float(row["arrival_qty_mt"]) if pd.notna(row["arrival_qty_mt"]) else None,
            "producing_region": PRODUCING_REGION.get(crop, {}).get(month, "agra"),
            "state": "NCT of Delhi",
            "district": "Delhi",
            "group": "Vegetables",
            "price_unit": "Rs./Quintal",
            "arrival_unit": "Metric Tonnes",
        }
        records.append(rec)

    if records:
        inserted = db.upsert_records(records)
        log.info(f"  [{crop}] {inserted} records inserted/updated in DB")
    return len(records)


def main():
    today = dt.date.today().isoformat()
    log.info(f"\n{'='*50}\nMandiQ Daily Scrape — {today}\n{'='*50}")

    total = 0
    for crop, cid in CROPS.items():
        df = scrape_today(crop, cid, today)
        if not df.empty:
            df["commodity"] = crop
            total += insert_to_db(df, crop)
        time.sleep(1)  # polite delay between crops

    log.info(f"\nDone. Total records updated: {total}")


if __name__ == "__main__":
    main()
