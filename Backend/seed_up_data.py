"""
seed_up_data.py — UP mandis (Prayagraj APMC, Jasra APMC) ke liye
initial 90-day synthetic price data DB mein insert karo.

Run karo ek baar:
    python seed_up_data.py

Agar records already hain to skip kar deta hai (upsert).
"""

import sys, os, datetime as dt, random, math, logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import MandiDB

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
log = logging.getLogger("seed_up")

# Base prices per crop per market (Rs./quintal)
BASE_PRICES = {
    "Prayagraj APMC": {
        "Tomato":    1700,
        "Potato":    1180,
        "Onion":     2050,
        "Okra":      1050,
        "RidgeGourd": 780,
        "LongBeans":  920,
    },
    "Jasra APMC": {
        "Tomato":    1620,
        "Potato":    1140,
        "Onion":     1980,
        "Okra":       990,
        "RidgeGourd": 740,
        "LongBeans":  870,
    },
}

PRODUCING_REGION = {
    "Tomato": "agra", "Potato": "agra", "Onion": "nashik",
    "Okra": "agra", "RidgeGourd": "agra", "LongBeans": "agra",
}


def gen_price_series(base: float, days: int, seed: int) -> list[float]:
    """Realistic random-walk price series around a base price."""
    rng = random.Random(seed)
    prices = []
    price = base
    for i in range(days):
        # Seasonal sine wave ±8% + daily noise ±3%
        seasonal = base * 0.08 * math.sin(2 * math.pi * i / 30)
        noise = rng.gauss(0, base * 0.03)
        price = max(base * 0.6, min(base * 1.5, price + seasonal * 0.1 + noise))
        prices.append(round(price))
    return prices


def seed():
    db = MandiDB()
    today = dt.date.today()
    DAYS = 365  # 365 days so reversion model (needs 200+ records) can train properly

    total = 0
    for market, crops in BASE_PRICES.items():
        for crop, base in crops.items():
            records = []
            prices = gen_price_series(base, DAYS, seed=hash(f"{crop}{market}") % 10000)
            for i, price in enumerate(prices):
                date = today - dt.timedelta(days=DAYS - 1 - i)
                records.append({
                    "date": date.isoformat(),
                    "commodity": crop,
                    "market": market,
                    "modal_price": price,
                    "arrival_qty": round(random.uniform(2.0, 12.0), 1),
                    "producing_region": PRODUCING_REGION.get(crop, "agra"),
                    "state": "Uttar Pradesh",
                    "district": "Prayagraj",
                    "group": "Vegetables",
                    "price_unit": "Rs./Quintal",
                    "arrival_unit": "Metric Tonnes",
                })
            inserted = db.upsert_records(records)
            log.info(f"  [{market}][{crop}] {inserted} records seeded")
            total += inserted

    log.info(f"\nDone. Total records seeded: {total}")


if __name__ == "__main__":
    # DEPRECATED — ye script NAKLI (synthetic) bhaav banati hai.
    # Asli data ke liye: python backfill_up_data.py
    #
    # Pehle main.py startup pe isko apne aap chalata tha, jisse users ko aur model
    # ko random-walk se bane fake bhaav milte the. Ab guard laga hai — sirf jaan
    # bujh ke --force dene par chalegi (testing waghairah ke liye).
    if "--force" not in sys.argv:
        log.error(
            "seed_up_data.py NAKLI data banati hai — by default band hai.\n"
            "  Asli data ke liye : python backfill_up_data.py\n"
            "  Phir bhi chalana ho: python seed_up_data.py --force"
        )
        sys.exit(1)
    log.warning("--force diya gaya hai — SYNTHETIC data DB mein daala ja raha hai!")
    seed()
