"""
backfill_up_data.py — UP (Prayagraj district) mandis ka ASLI data AGMARKNET se
laao aur DB mein bharo. seed_up_data.py (synthetic) ka replacement.

Allowed date range API se hi poochta hai (filters endpoint) — "Both" mode mein
AGMARKNET sirf ~1 saal deta hai, isliye hardcode karne ka fayda nahi.

Run:
    python backfill_up_data.py                 # jitna range allowed hai, utna
    python backfill_up_data.py --days 120      # sirf pichhle 120 din
    python backfill_up_data.py --purge-synthetic   # pehle purane UP rows hatao
"""

import os
import sys
import time
import argparse
import logging
import datetime as dt

import requests as req

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from daily_scrape import (
    UP_CROPS, UP_MARKETS, scrape_up_range, insert_to_db,
    DATA_TYPE_BOTH, DATA_TYPE_PRICE,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
log = logging.getLogger("backfill_up")

FILTERS_URL = "https://api.agmarknet.gov.in/v1/daily-price-arrival/filters"
FILTERS_HEADERS = {
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0",
}


def allowed_range() -> tuple[str, str]:
    """AGMARKNET se poochho ki 'Both' (price+arrival) mode mein kitna peeche ja sakte hain."""
    fallback_to = (dt.date.today() - dt.timedelta(days=1)).isoformat()
    fallback_from = (dt.date.today() - dt.timedelta(days=300)).isoformat()
    try:
        r = req.get(FILTERS_URL, headers=FILTERS_HEADERS, timeout=60)
        both = r.json()["data"]["range_data"][0]["both"]
        return both["from_date"], both["to_date"]
    except Exception as e:
        log.warning(f"Filters endpoint se range nahi mili ({e}) — fallback use kar rahe hain")
        return fallback_from, fallback_to


def purge_synthetic() -> int:
    """
    UP ke purane rows hatao (seed_up_data.py ka synthetic data).

    Sirf 'Uttar Pradesh' state ke rows — Delhi ka asli data chhua nahi jaata.
    """
    import sqlite3
    from database import DB_PATH

    con = sqlite3.connect(DB_PATH)
    try:
        n = con.execute(
            "SELECT COUNT(*) FROM price_records WHERE state = 'Uttar Pradesh'"
        ).fetchone()[0]
        con.execute("DELETE FROM price_records WHERE state = 'Uttar Pradesh'")
        con.commit()
        log.info(f"Purge: {n} purane UP rows hataye")
        return n
    finally:
        con.close()


def backfill_history(start_year: int = 2021, only_crop: str | None = None) -> int:
    """
    Purani history laao — price-only mode se, saal-dar-saal.

    Model ko har crop x mandi ke 200+ usable rows chahiye (mandiq_reversion.py),
    warna woh pair skip ho jata hai. "Both" mode sirf ~1 saal deta hai, jisse itne
    rows bante hi nahi. Price-only mode 2021 tak jata hai — arrival quantity nahi
    milti, par model ko sirf price chahiye.

    API ek request mein max 1 saal deti hai, isliye har saal alag call.
    """
    today = dt.date.today()
    total = 0

    crops = UP_CROPS if not only_crop else {only_crop: UP_CROPS[only_crop]}
    for crop, cid in crops.items():
        crop_rows = 0
        for year in range(start_year, today.year + 1):
            frm = f"{year}-01-01"
            to = min(dt.date(year, 12, 31), today).isoformat()
            df = scrape_up_range(crop, cid, frm, to, data_type=DATA_TYPE_PRICE)
            if df.empty:
                continue
            df["commodity"] = crop
            crop_rows += insert_to_db(df, crop, state="Uttar Pradesh", district="Prayagraj")
            time.sleep(2)
        log.info(f"[{crop}] history total: {crop_rows} rows")
        total += crop_rows

    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=None,
                    help="Sirf pichhle N din (default: jitna API allow kare)")
    ap.add_argument("--purge-synthetic", action="store_true",
                    help="Backfill se pehle saare UP rows delete karo")
    ap.add_argument("--history", action="store_true",
                    help="2021 se poori price history laao (model training ke liye)")
    ap.add_argument("--start-year", type=int, default=2021,
                    help="--history ke saath: kis saal se shuru karein")
    ap.add_argument("--crop", choices=sorted(UP_CROPS), default=None,
                    help="Sirf ek crop (network fail hone par dobara chalane ke liye)")
    args = ap.parse_args()

    if args.purge_synthetic:
        purge_synthetic()

    if args.history:
        log.info(f"\n{'=' * 55}")
        log.info(f"UP price history backfill | {args.start_year} → ab tak")
        log.info(f"{'=' * 55}")
        n = backfill_history(args.start_year, args.crop)
        log.info(f"\nHistory done: {n} rows")
        return 0 if n else 1

    api_from, api_to = allowed_range()
    if args.days:
        want_from = (dt.date.today() - dt.timedelta(days=args.days)).isoformat()
        from_date = max(api_from, want_from)
    else:
        from_date = api_from
    to_date = api_to

    log.info(f"\n{'=' * 55}")
    log.info(f"UP backfill (ASLI data) | {from_date} → {to_date}")
    log.info(f"Crops  : {', '.join(UP_CROPS)}")
    log.info(f"Mandis : {', '.join(sorted(set(UP_MARKETS.values())))}")
    log.info(f"{'=' * 55}")

    total = 0
    for crop, cid in UP_CROPS.items():
        df = scrape_up_range(crop, cid, from_date, to_date)
        if df.empty:
            log.warning(f"[{crop}] koi data nahi mila")
            continue
        df["commodity"] = crop
        n = insert_to_db(df, crop, state="Uttar Pradesh", district="Prayagraj")
        total += n
        per_market = df.groupby("market")["date"].nunique().to_dict()
        log.info(f"[{crop}] {n} rows inserted | {per_market}")
        time.sleep(2)

    log.info(f"\nDone. Total real records: {total}")
    return 0 if total else 1


if __name__ == "__main__":
    sys.exit(main())
