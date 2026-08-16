#!/usr/bin/env python3
"""
agmarknet_scraper.py — MandiQ Daily Price Scraper
==================================================
Fetches daily crop price + arrival data for 3 Delhi mandis from Agmarknet 2.0 API.

Endpoint: POST https://api.agmarknet.gov.in/v1/daily-price-arrival/report
Markets:  Azadpur APMC, Keshopur APMC, Shahdara APMC

USAGE
-----
    # Fetch today's Tomato data, append to CSV:
    python agmarknet_scraper.py

    # Specific crop:
    python agmarknet_scraper.py --crop Potato

    # All crops at once:
    python agmarknet_scraper.py --crop all

    # Custom date range:
    python agmarknet_scraper.py --from 2026-06-01 --to 2026-07-03

    # Custom output directory:
    python agmarknet_scraper.py --data-dir D:/MandiQ/data
"""

import os
import sys
import time
import argparse
import datetime as dt

import requests
import pandas as pd

from captcha_solver import get_solved_captcha, report_bad_captcha

# ─── CONFIG ───────────────────────────────────────────────────────────────── #

API_URL = "https://api.agmarknet.gov.in/v1/daily-price-arrival/report"

HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

# Commodity IDs
CROPS = {
    "Tomato":  "65",
    "Potato":  "24",
    "Onion":   "23",
    "Spinach": "290",
}

# Market name matching (API response name → our label)
DELHI_MARKETS = {
    "azadpur":  "Azadpur APMC",
    "keshopur": "Keshopur APMC",
    "shahdara": "Shahdara APMC",
}

# Season mapping
SEASON_MAP = {
    12: "Rabi_Peak", 1: "Rabi_Peak", 2: "Rabi_Peak", 3: "Rabi_Peak",
    4: "Post_Harvest", 5: "Post_Harvest",
    6: "Off_Season", 7: "Off_Season", 8: "Off_Season", 9: "Off_Season",
    10: "Pre_Harvest", 11: "Pre_Harvest",
}
SEASON_CODE = {"Rabi_Peak": 1, "Post_Harvest": 2, "Off_Season": 3, "Pre_Harvest": 4}

# Output CSV columns (matches existing clean data schema)
SCHEMA = [
    "Market", "Date", "Arrival_Quantity_MT", "Min_Price",
    "Modal_Price", "Max_Price", "Year", "Month", "Week",
    "Season_Label", "Season_Code",
]


# ─── HELPERS ──────────────────────────────────────────────────────────────── #

def parse_num(x):
    """'1,400.00' → 1400.0"""
    return pd.to_numeric(str(x).replace(",", ""), errors="coerce")


def match_market(name):
    """API market name → our label, or None if not Delhi."""
    low = str(name).lower()
    for key, label in DELHI_MARKETS.items():
        if key in low:
            return label
    return None


def add_date_features(df):
    """Add Year, Month, Week, Season columns."""
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Year"] = df["Date"].dt.year
    df["Month"] = df["Date"].dt.month
    df["Week"] = df["Date"].dt.isocalendar().week.astype(int)
    df["Season_Label"] = df["Month"].map(SEASON_MAP)
    df["Season_Code"] = df["Season_Label"].map(SEASON_CODE)
    return df


# ─── FETCH ────────────────────────────────────────────────────────────────── #

def fetch_crop(crop_name, commodity_id, from_date, to_date):
    """
    Fetch price+arrival data for one crop from Agmarknet API.
    Filters for Delhi (state=25) and handles pagination.
    Returns DataFrame with Delhi market rows only.
    """
    body = {
        "data_type": "100006",          # Both price + arrival
        "commodity": commodity_id,
        "group": "6",                   # Vegetables
        "state": "[25]",                # NCT of Delhi only
        "district": "[100001]",         # All districts
        "variety": "[100007]",          # All varieties
        "grade": "[100003]",            # All grades
        "market": "[100002]",           # All markets
        "from_date": from_date,
        "to_date": to_date,
        "page": "1",
        "limit": "50",
    }

    all_rows = []
    page = 1
    max_pages = 100
    captcha_retries = 0
    max_captcha_retries = 3

    print(f"  [{crop_name}] Fetching {from_date} → {to_date} ...", end=" ")

    while page <= max_pages:
        body["page"] = str(page)

        # Each request needs a fresh, freshly-solved captcha (single-use key)
        try:
            captcha_key, captcha_answer, captcha_id = get_solved_captcha()
        except Exception as e:
            print(f"\n  ERROR solving captcha: {e}")
            break
        body["captcha_key"] = captcha_key
        body["captcha"] = captcha_answer

        try:
            r = requests.post(API_URL, json=body, headers=HEADERS, timeout=90)
            js = r.json()
        except Exception as e:
            print(f"\n  ERROR page {page}: {e}")
            break

        # Wrong captcha solve — retry with a fresh one instead of aborting
        if js.get("code") in ("TOKEN_OR_CAPTCHA_REQUIRED", "INVALID_CAPTCHA"):
            captcha_retries += 1
            report_bad_captcha(captcha_id)
            if captcha_retries <= max_captcha_retries:
                print(f"\n  [captcha] rejected, reporting bad + retrying ({captcha_retries}/{max_captcha_retries})...", end=" ")
                continue
            print(f"\n  ERROR: captcha rejected {max_captcha_retries} times, giving up")
            break

        if not js.get("status"):
            print(f"\n  API error: {js.get('message', 'unknown')}")
            break

        captcha_retries = 0

        data = js.get("data", {})
        for rec in data.get("records", []):
            all_rows.extend(rec.get("data", []))

        # Pagination check
        pag = (data.get("pagination") or [{}])[0] if data.get("records") else {}
        if not pag:
            # Try pagination from records
            for rec in data.get("records", []):
                pag_list = rec.get("pagination", [{}])
                if pag_list:
                    pag = pag_list[0]
                    break

        current = pag.get("current_page", 1)
        total = pag.get("total_pages", 1)
        if current >= total:
            break
        page += 1
        time.sleep(0.5)  # polite delay

    if not all_rows:
        print("no data returned")
        return pd.DataFrame(columns=["Market", "Date", "Min_Price",
                                     "Modal_Price", "Max_Price",
                                     "Arrival_Quantity_MT"])

    # Parse into DataFrame
    raw = pd.DataFrame(all_rows)
    df = pd.DataFrame({
        "Market": raw["market_name"].map(match_market),
        "Date": pd.to_datetime(raw["arrival_date"], dayfirst=True, errors="coerce"),
        "Min_Price": raw["min_price"].map(parse_num),
        "Modal_Price": raw["model_price"].map(parse_num),  # their typo: model = modal
        "Max_Price": raw["max_price"].map(parse_num),
        "Arrival_Quantity_MT": raw["arrival_qty"].map(parse_num),
    })

    # Keep only Delhi markets (drop None)
    df = df.dropna(subset=["Market", "Date", "Modal_Price"]).reset_index(drop=True)

    if len(df):
        markets = sorted(df["Market"].unique())
        print(f"{len(df)} rows | {markets} | {df['Date'].min().date()} → {df['Date'].max().date()}")
    else:
        print("0 Delhi rows (markets may not have reported)")

    return df


# ─── VALIDATE ─────────────────────────────────────────────────────────────── #

def validate(df, crop_name):
    """Basic quality checks. Returns list of problems (empty = OK)."""
    problems = []

    if df.empty:
        return ["no data to validate"]

    # Price sanity
    bad_price = df[
        (df["Min_Price"] <= 0) |
        (df["Modal_Price"] <= 0) |
        (df["Min_Price"] > df["Modal_Price"]) |
        (df["Modal_Price"] > df["Max_Price"])
    ]
    if len(bad_price):
        problems.append(f"{len(bad_price)} rows fail price check (Min≤Modal≤Max)")

    # Future dates
    if (df["Date"] > pd.Timestamp.today() + pd.Timedelta(days=1)).any():
        problems.append("future dates detected")

    # Negative arrivals
    if (df["Arrival_Quantity_MT"] <= 0).any():
        problems.append("non-positive arrivals")

    if problems:
        print(f"  [{crop_name}] VALIDATION issues: {problems}")
    else:
        print(f"  [{crop_name}] Validation passed ✓")

    return problems


# ─── SAVE / APPEND ────────────────────────────────────────────────────────── #

def save_data(df, crop_name, data_dir):
    """
    Append new rows to existing clean CSV.
    If CSV doesn't exist, creates it fresh.
    """
    os.makedirs(data_dir, exist_ok=True)
    csv_path = os.path.join(data_dir, f"{crop_name}_Clean_data.csv")

    # Add date features
    df = add_date_features(df.copy())
    df = df[SCHEMA]

    if os.path.exists(csv_path):
        existing = pd.read_csv(csv_path, parse_dates=["Date"])
        combined = pd.concat([existing, df], ignore_index=True)
        # Remove duplicates: keep latest entry per (Market, Date)
        combined = (combined
                    .sort_values(["Market", "Date"])
                    .drop_duplicates(subset=["Market", "Date"], keep="last")
                    .reset_index(drop=True))
        combined.to_csv(csv_path, index=False)
        new_count = len(combined) - len(existing)
        print(f"  [{crop_name}] Appended {new_count} new rows → {csv_path}")
        print(f"  [{crop_name}] Total: {len(combined)} rows")
    else:
        df = (df.sort_values(["Market", "Date"])
                .drop_duplicates(subset=["Market", "Date"], keep="last")
                .reset_index(drop=True))
        df.to_csv(csv_path, index=False)
        print(f"  [{crop_name}] Created new file with {len(df)} rows → {csv_path}")

    # Per-market summary
    final = pd.read_csv(csv_path, parse_dates=["Date"])
    for mkt, grp in final.groupby("Market"):
        print(f"       {mkt:15s}  {grp['Date'].min().date()} → {grp['Date'].max().date()}  ({len(grp)} rows)")

    return csv_path


# ─── BACKUP RAW ───────────────────────────────────────────────────────────── #

def save_raw_backup(df, crop_name, data_dir):
    """Save raw scrape as dated backup (audit trail)."""
    raw_dir = os.path.join(data_dir, "raw_daily")
    os.makedirs(raw_dir, exist_ok=True)
    stamp = dt.date.today().isoformat()
    path = os.path.join(raw_dir, f"{crop_name}_{stamp}.csv")
    df.to_csv(path, index=False)
    return path


# ─── LOG ──────────────────────────────────────────────────────────────────── #

def log_run(crop_name, rows, problems, data_dir):
    """Append one line to the run log."""
    log_dir = os.path.join(data_dir, "logs")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "scraper.log"), "a") as f:
        f.write(f"{dt.datetime.now()} | {crop_name} | rows={rows} | problems={problems}\n")


# ─── AUTO-DETECT START DATE ──────────────────────────────────────────────── #

def detect_start_date(crop_name, data_dir):
    """Find day after latest date in existing CSV. Fallback: 30 days ago."""
    csv_path = os.path.join(data_dir, f"{crop_name}_Clean_data.csv")
    if os.path.exists(csv_path):
        try:
            d = pd.read_csv(csv_path, parse_dates=["Date"])["Date"].max()
            start = (d + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
            print(f"  [{crop_name}] Last date in CSV: {d.date()} → starting from {start}")
            return start
        except Exception:
            pass
    fallback = (dt.date.today() - dt.timedelta(days=30)).isoformat()
    print(f"  [{crop_name}] No existing CSV → starting from {fallback}")
    return fallback


# ─── MAIN ─────────────────────────────────────────────────────────────────── #

def process_crop(crop_name, commodity_id, from_date, to_date, data_dir):
    """Full pipeline for one crop: fetch → validate → backup → save."""
    print(f"\n{'='*60}")
    print(f"  CROP: {crop_name} (commodity_id={commodity_id})")
    print(f"{'='*60}")

    # Auto-detect start date if not provided
    if from_date is None:
        from_date = detect_start_date(crop_name, data_dir)

    # Check if from_date > to_date (already up to date)
    if from_date > to_date:
        print(f"  [{crop_name}] Already up to date! (last={from_date}, today={to_date})")
        return

    # 1. Fetch
    df = fetch_crop(crop_name, commodity_id, from_date, to_date)

    # 2. Backup raw
    if not df.empty:
        save_raw_backup(df, crop_name, data_dir)

    # 3. Validate
    problems = validate(df, crop_name)

    # 4. Log
    log_run(crop_name, len(df), problems, data_dir)

    # 5. Save (even if minor validation issues — log them but proceed)
    if df.empty:
        print(f"  [{crop_name}] No data to save.")
        return

    if any("future dates" in p for p in problems):
        print(f"  [{crop_name}] BLOCKED: future dates found, not saving.")
        return

    save_data(df, crop_name, data_dir)


def main():
    parser = argparse.ArgumentParser(
        description="MandiQ — Agmarknet daily price scraper for Delhi mandis"
    )
    parser.add_argument(
        "--crop", default="Tomato",
        help="Crop name: Tomato, Potato, or 'all' (default: Tomato)"
    )
    parser.add_argument(
        "--from", dest="from_date", default=None,
        help="Start date YYYY-MM-DD (default: auto-detect from CSV)"
    )
    parser.add_argument(
        "--to", dest="to_date",
        default=dt.date.today().isoformat(),
        help="End date YYYY-MM-DD (default: today)"
    )
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("MANDIQ_DATA_DIR", "./data"),
        help="Data directory (default: ./data or $MANDIQ_DATA_DIR)"
    )
    args = parser.parse_args()

    print("╔══════════════════════════════════════════╗")
    print("║    MandiQ — Agmarknet Daily Scraper      ║")
    print("╚══════════════════════════════════════════╝")
    print(f"  Data dir: {os.path.abspath(args.data_dir)}")
    print(f"  Date range: {args.from_date or 'auto'} → {args.to_date}")

    # Determine which crops to process
    if args.crop.lower() == "all":
        crops_to_run = CROPS
    else:
        name = args.crop.capitalize()
        if name not in CROPS:
            print(f"\n  ERROR: Unknown crop '{name}'. Available: {list(CROPS.keys())}")
            sys.exit(1)
        crops_to_run = {name: CROPS[name]}

    # Process each crop
    for crop_name, commodity_id in crops_to_run.items():
        process_crop(crop_name, commodity_id, args.from_date, args.to_date, args.data_dir)

    print(f"\n{'='*60}")
    print("  DONE ✓")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()