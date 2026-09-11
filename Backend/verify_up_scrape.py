"""
verify_up_scrape.py — Test karo ki UP state ke liye AGMARKNET API kya return karta hai.
Isse pata chalega ki Prayagraj/Jasra mandis aur Okra/RidgeGourd/LongBeans ke IDs sahi hain ya nahi.

Run:
    python verify_up_scrape.py
"""
import sys, os, json, requests as req

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from captcha_solver import get_solved_captcha, report_bad_captcha

API_URL = "https://api.agmarknet.gov.in/v1/daily-price-arrival/report"
API_HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0",
}

# Test: last 30 days, UP state (36), crop by crop
TEST_CROPS = {
    "Tomato":     "65",
    "Potato":     "24",
    "Onion":      "23",
    "Okra":       "71",   # Bhindi(Ladies Finger)
    "RidgeGourd": "132",  # Ridgeguard(Tori)
    "LongBeans":  "75",   # Cowpea(Veg) / Boda
}

import datetime as dt
yesterday = (dt.date.today() - dt.timedelta(days=1)).isoformat()
month_ago = (dt.date.today() - dt.timedelta(days=30)).isoformat()


def test_crop(crop_name: str, commodity_id: str):
    print(f"\n{'='*50}")
    print(f"Testing: {crop_name} (ID={commodity_id}) | UP (state=34) | {month_ago} → {yesterday}")

    for attempt in range(3):
        try:
            captcha_key, captcha_answer, captcha_id = get_solved_captcha()
        except Exception as e:
            print(f"  Captcha error: {e}")
            return

        body = {
            "data_type": "100006",
            "commodity": commodity_id,
            "group": "6",
            "state": "[34]",
            "district": "[100001]",
            "variety": "[100007]",
            "grade": "[100003]",
            "market": "[100002]",
            "from_date": month_ago,
            "to_date": yesterday,
            "page": "1",
            "limit": "200",
            "captcha_key": captcha_key,
            "captcha": captcha_answer,
        }

        try:
            r = req.post(API_URL, json=body, headers=API_HEADERS, timeout=60)
            js = r.json()
        except Exception as e:
            print(f"  Request error: {e}")
            return

        if js.get("code") in ("TOKEN_OR_CAPTCHA_REQUIRED", "INVALID_CAPTCHA"):
            print(f"  Bad captcha (attempt {attempt+1}/3), retrying...")
            report_bad_captcha(captcha_id)
            continue

        print(f"  Status: {js.get('status')} | Code: {js.get('code')} | Message: {js.get('message','')}")

        records = []
        data = js.get("data") or {}
        if isinstance(data, list):
            records = data
        else:
            for rec in data.get("records", []):
                records.extend(rec.get("data", []))

        if not records:
            print(f"  >>> NO DATA RETURNED for {crop_name} in UP <<<")
            return

        # Show unique markets found
        markets = sorted(set(r.get("market_name", "?") for r in records))
        print(f"  Markets found ({len(markets)}): {markets}")
        print(f"  Total rows: {len(records)}")
        # Check for Prayagraj / Jasra
        hits = [m for m in markets if any(k in m.lower() for k in ("prayagraj","allahabad","jasra"))]
        if hits:
            print(f"  *** TARGET MARKETS FOUND: {hits} ***")
        else:
            print(f"  (Prayagraj/Jasra NOT in results — different name or no data)")
        print(f"  Sample row: {json.dumps(records[0], indent=2)}")
        return

    print(f"  FAILED after 3 captcha attempts")


if __name__ == "__main__":
    print("AGMARKNET UP State Verification")
    print(f"Date range: {month_ago} to {yesterday}")
    for crop, cid in TEST_CROPS.items():
        test_crop(crop, cid)
    print("\n\nDone. Check above for which crops/markets returned data.")
