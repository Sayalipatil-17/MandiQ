"""
run_pipeline.py — MandiQ Auto Pipeline
Scrape → Weather → Clean CSV → DB Insert → Train

Usage:
    python run_pipeline.py                    # all crops, auto dates
    python run_pipeline.py --crop Tomato
    python run_pipeline.py --crop all --from 2021-01-01
"""

import os, sys, time, argparse
import datetime as dt
import numpy as np
import pandas as pd
import requests as req
import logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from captcha_solver import get_solved_captcha, report_bad_captcha

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
log = logging.getLogger("pipeline")

# ─── CONFIG ───────────────────────────────────────────────────────────────── #

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

PRODUCING_REGION = {
    "Tomato": {1:"agra",2:"agra",3:"kolar",4:"kolar",5:"kolar",
               6:"solan",7:"solan",8:"solan",9:"solan",10:"agra",11:"agra",12:"agra"},
    "Potato": {1:"agra",2:"agra",3:"agra",4:"agra",5:"agra",
               6:"solan",7:"solan",8:"solan",9:"agra",10:"agra",11:"agra",12:"agra"},
    "Onion": {1:"nashik",2:"nashik",3:"nashik",4:"nashik",5:"nashik",
              6:"nashik",7:"nashik",8:"nashik",9:"nashik",10:"nashik",11:"nashik",12:"nashik"},
    "Spinach": {1:"agra",2:"agra",3:"agra",4:"solan",5:"solan",
                6:"solan",7:"agra",8:"agra",9:"agra",10:"agra",11:"agra",12:"agra"},
}

REGION_COORDS = {
    "agra":   {"lat": 27.18, "lon": 78.02},
    "solan":  {"lat": 30.90, "lon": 77.10},
    "kolar":  {"lat": 13.14, "lon": 78.13},
    "nashik": {"lat": 19.99, "lon": 73.79},
}
DELHI_COORDS = {"lat": 28.66, "lon": 77.21}

CROP_WEATHER_LAG = {"Tomato": 4, "Potato": 6, "Onion": 6, "Spinach": 1}

SEASON_MAP = {12:"winter",1:"winter",2:"winter",
              3:"summer",4:"summer",5:"summer",
              6:"monsoon",7:"monsoon",8:"monsoon",9:"monsoon",
              10:"post_monsoon",11:"post_monsoon"}

DATA_DIR = "data"


# ═══════════════════════════════════════════════════════════════════════════ #
#  STEP 1: SCRAPE
# ═══════════════════════════════════════════════════════════════════════════ #

def scrape(crop, commodity_id, from_date, to_date):
    log.info(f"[SCRAPE] {crop} ({from_date} → {to_date})")
    body = {
        "data_type":"100006","commodity":commodity_id,"group":"6",
        "state":"[25]","district":"[100001]","variety":"[100007]",
        "grade":"[100003]","market":"[100002]",
        "from_date":from_date,"to_date":to_date,"page":"1","limit":"50",
    }
    all_rows, page = [], 1
    captcha_retries = 0
    while page <= 100:
        body["page"] = str(page)
        try:
            captcha_key, captcha_answer, captcha_id = get_solved_captcha()
        except Exception as e:
            log.error(f"  Captcha solve error: {e}"); break
        body["captcha_key"] = captcha_key
        body["captcha"] = captcha_answer
        try:
            r = req.post(API_URL, json=body, headers=API_HEADERS, timeout=90)
            js = r.json()
        except Exception as e:
            log.error(f"  Page {page} error: {e}"); break
        if js.get("code") in ("TOKEN_OR_CAPTCHA_REQUIRED", "INVALID_CAPTCHA"):
            captcha_retries += 1
            report_bad_captcha(captcha_id)
            if captcha_retries > 5:
                log.error("  Captcha rejected 5 times, giving up"); break
            log.warning(f"  Captcha rejected, reporting bad + retrying ({captcha_retries}/5)...")
            continue
        captcha_retries = 0
        if not js.get("status"): break
        for rec in js.get("data",{}).get("records",[]):
            all_rows.extend(rec.get("data",[]))
        recs = js.get("data",{}).get("records",[])
        pag = (recs[0].get("pagination",[{}]) if recs else [{}])
        pag = pag[0] if pag else {}
        if pag.get("current_page",1) >= pag.get("total_pages",1): break
        page += 1; time.sleep(0.5)

    if not all_rows:
        log.info("  No data"); return pd.DataFrame()

    pnum = lambda x: pd.to_numeric(str(x).replace(",",""), errors="coerce")
    raw = pd.DataFrame(all_rows)
    df = pd.DataFrame({
        "date": pd.to_datetime(raw["arrival_date"], dayfirst=True, errors="coerce"),
        "market": raw["market_name"].map(lambda m: next((v for k,v in DELHI_MARKETS.items() if k in str(m).lower()), None)),
        "arrival_qty_mt": raw["arrival_qty"].map(pnum),
        "modal_price_rs_quintal": raw["model_price"].map(pnum),
    }).dropna(subset=["market","date","modal_price_rs_quintal"]).reset_index(drop=True)

    log.info(f"  {len(df)} rows | {sorted(df['market'].unique())}")
    return df


# ═══════════════════════════════════════════════════════════════════════════ #
#  STEP 2: WEATHER
# ═══════════════════════════════════════════════════════════════════════════ #

def fetch_weather_loc(lat, lon, from_date, to_date, prefix):
    url = (f"https://archive-api.open-meteo.com/v1/archive?"
           f"latitude={lat}&longitude={lon}&start_date={from_date}&end_date={to_date}"
           f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean"
           f"&timezone=Asia/Kolkata")
    try:
        js = req.get(url, timeout=60).json().get("daily",{})
        return pd.DataFrame({
            "date": pd.to_datetime(js["time"]),
            f"{prefix}_temp_max": js["temperature_2m_max"],
            f"{prefix}_temp_min": js["temperature_2m_min"],
            f"{prefix}_rainfall": js["precipitation_sum"],
            f"{prefix}_humidity": js["relative_humidity_2m_mean"],
        })
    except Exception as e:
        log.error(f"  Weather {prefix} failed: {e}")
        return pd.DataFrame()


def add_weather(df, crop, from_date, to_date):
    log.info(f"[WEATHER] Fetching Delhi + producing region (lagged)")
    lag_days = CROP_WEATHER_LAG.get(crop, 4)
    extended_from = (pd.to_datetime(from_date) - pd.Timedelta(days=lag_days+7)).strftime("%Y-%m-%d")

    # Delhi weather
    delhi_w = fetch_weather_loc(DELHI_COORDS["lat"], DELHI_COORDS["lon"], extended_from, to_date, "delhi")

    # All region weather
    regions_needed = set(PRODUCING_REGION.get(crop, {}).values())
    region_dfs = {}
    for region in regions_needed:
        coords = REGION_COORDS.get(region)
        if coords:
            rdf = fetch_weather_loc(coords["lat"], coords["lon"], extended_from, to_date, "r")
            if not rdf.empty:
                region_dfs[region] = rdf

    # Merge delhi
    if not delhi_w.empty:
        df = df.merge(delhi_w, on="date", how="left")

    # Build lagged region weather per row
    region_rows = []
    for _, row in df.iterrows():
        month = row["date"].month
        region = PRODUCING_REGION.get(crop, {}).get(month, "agra")
        lagged_date = row["date"] - pd.Timedelta(days=lag_days)
        rdf = region_dfs.get(region)
        rr = {"date": row["date"]}
        if rdf is not None and not rdf.empty:
            match = rdf[rdf["date"] == lagged_date]
            if not match.empty:
                rr["region_temp_max"] = match.iloc[0]["r_temp_max"]
                rr["region_temp_min"] = match.iloc[0]["r_temp_min"]
                rr["region_rainfall"] = match.iloc[0]["r_rainfall"]
                rr["region_humidity"] = match.iloc[0]["r_humidity"]
        region_rows.append(rr)

    if region_rows:
        rdf = pd.DataFrame(region_rows)
        df = df.merge(rdf, on="date", how="left")

    for c in [c for c in df.columns if "delhi_" in c or "region_" in c]:
        df[c] = df[c].ffill().bfill()

    return df


# ═══════════════════════════════════════════════════════════════════════════ #
#  STEP 3: BUILD CLEAN CSV
# ═══════════════════════════════════════════════════════════════════════════ #

def build_clean_csv(df, crop):
    log.info(f"[CSV] Building clean CSV")
    csv_path = os.path.join(DATA_DIR, f"{crop}_Clean_data.csv")

    df["month"] = df["date"].dt.month
    df["season"] = df["month"].map(SEASON_MAP)
    df["producing_region"] = df["month"].map(PRODUCING_REGION.get(crop, {}))

    if os.path.exists(csv_path):
        existing = pd.read_csv(csv_path, parse_dates=["date"])
        df = pd.concat([existing, df], ignore_index=True)

    df = df.drop_duplicates(subset=["date","market"], keep="last")
    df = df.sort_values(["market","date"]).reset_index(drop=True)

    cols = ["date","market","arrival_qty_mt","modal_price_rs_quintal","month","season",
            "producing_region","delhi_temp_max","delhi_temp_min","delhi_rainfall",
            "delhi_humidity","region_temp_max","region_temp_min","region_rainfall","region_humidity"]
    for c in cols:
        if c not in df.columns: df[c] = np.nan
    df = df[cols]

    os.makedirs(DATA_DIR, exist_ok=True)
    df.to_csv(csv_path, index=False)
    log.info(f"  {csv_path} ({len(df)} rows)")
    return df, csv_path


# ═══════════════════════════════════════════════════════════════════════════ #
#  STEP 4: DB INSERT + TRAIN
# ═══════════════════════════════════════════════════════════════════════════ #

def insert_and_train(df, crop):
    log.info(f"[TRAIN] DB insert + training")
    from database import MandiDB
    from model_trainer import MandiModelTrainer
    from predictor import MandiPredictor

    db = MandiDB()
    trainer = MandiModelTrainer()
    predictor = MandiPredictor()

    for market, grp in df.groupby("market"):
        records = []
        for _, row in grp.iterrows():
            rec = {
                "date": str(row["date"].date()) if hasattr(row["date"], "date") else str(row["date"])[:10],
                "commodity": crop, "market": market,
                "modal_price": float(row["modal_price_rs_quintal"]) if pd.notna(row["modal_price_rs_quintal"]) else None,
                "arrival_qty": float(row["arrival_qty_mt"]) if pd.notna(row["arrival_qty_mt"]) else None,
            }
            for col in ["delhi_temp_max","delhi_temp_min","delhi_rainfall","delhi_humidity",
                        "region_temp_max","region_temp_min","region_rainfall","region_humidity"]:
                if col in row.index and pd.notna(row[col]):
                    rec[col] = float(row[col])
            if "producing_region" in row.index and pd.notna(row.get("producing_region")):
                rec["producing_region"] = row["producing_region"]
            records.append(rec)

        inserted = db.upsert_records(records)
        log.info(f"  {market}: {inserted} inserted")

        if len(records) >= 60:
            try:
                data = db.get_data(commodity=crop, market=market)
                metrics = trainer.train(data, crop, market, "ensemble")
                predictor.load_model(crop, market)
                log.info(f"  {market}: CV MAPE = {metrics['cv_mape_avg']}%")
            except Exception as e:
                log.error(f"  {market}: Train failed — {e}")
        else:
            log.info(f"  {market}: only {len(records)} rows, need 60+")


# ═══════════════════════════════════════════════════════════════════════════ #
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════ #

def detect_start(crop):
    csv = os.path.join(DATA_DIR, f"{crop}_Clean_data.csv")
    if os.path.exists(csv):
        try:
            d = pd.read_csv(csv, parse_dates=["date"])["date"].max()
            return (d + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
        except: pass
    return (dt.date.today() - dt.timedelta(days=365)).isoformat()


def run_crop(crop, commodity_id, from_date, to_date):
    log.info(f"\n{'='*50}\n  {crop}\n{'='*50}")
    if from_date is None:
        from_date = detect_start(crop)
    
    if from_date > to_date:
        log.info("  Up to date, retraining")
        csv = os.path.join(DATA_DIR, f"{crop}_Clean_data.csv")
        if os.path.exists(csv):
            insert_and_train(pd.read_csv(csv, parse_dates=["date"]), crop)
        return

    scraped = scrape(crop, commodity_id, from_date, to_date)
    if scraped.empty:
        csv = os.path.join(DATA_DIR, f"{crop}_Clean_data.csv")
        if os.path.exists(csv):
            insert_and_train(pd.read_csv(csv, parse_dates=["date"]), crop)
        return

    scraped = add_weather(scraped, crop, from_date, to_date)
    df, _ = build_clean_csv(scraped, crop)
    insert_and_train(df, crop)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--crop", default="all")
    ap.add_argument("--from", dest="from_date", default=None)
    ap.add_argument("--to", dest="to_date", default=dt.date.today().isoformat())
    args = ap.parse_args()

    print("╔════════════════════════════════════╗")
    print("║  MandiQ Pipeline                   ║")
    print("║  Scrape → Weather → CSV → Train    ║")
    print("╚════════════════════════════════════╝")

    crops = CROPS if args.crop.lower() == "all" else {args.crop.capitalize(): CROPS[args.crop.capitalize()]}
    for crop, cid in crops.items():
        run_crop(crop, cid, args.from_date, args.to_date)
    print("\n✓ DONE")


if __name__ == "__main__":
    main()