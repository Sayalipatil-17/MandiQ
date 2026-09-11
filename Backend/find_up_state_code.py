"""
find_up_state_code.py — AGMARKNET mein UP ka sahi state code dhundo.
Tomato (ID=65) ke saath alag alag state codes try karo, jis mein
'Prayagraj' ya 'Allahabad' market aaye — woh UP ka code hai.

Run:
    python find_up_state_code.py
"""
import sys, os, requests as req, datetime as dt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from captcha_solver import get_solved_captcha, report_bad_captcha

API_URL = "https://api.agmarknet.gov.in/v1/daily-price-arrival/report"
API_HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0",
}

yesterday = (dt.date.today() - dt.timedelta(days=1)).isoformat()
month_ago = (dt.date.today() - dt.timedelta(days=30)).isoformat()

# Common AGMARKNET state codes to try — UP is likely 9 or around there
# Reference: census code for UP = 9, Rajasthan=8, MP=23, etc.
STATE_CODES_TO_TRY = [34]


def try_state(state_code: int):
    for attempt in range(4):
        try:
            captcha_key, captcha_answer, captcha_id = get_solved_captcha()
        except Exception as e:
            print(f"  Captcha error: {e}")
            return
        body = {
            "data_type": "100006", "commodity": "65",  # Tomato
            "group": "6", "state": f"[{state_code}]",
            "district": "[100001]", "variety": "[100007]",
            "grade": "[100003]", "market": "[100002]",
            "from_date": month_ago, "to_date": yesterday,
            "page": "1", "limit": "50",
            "captcha_key": captcha_key, "captcha": captcha_answer,
        }
        try:
            r = req.post(API_URL, json=body, headers=API_HEADERS, timeout=60)
            js = r.json()
        except Exception as e:
            print(f"  [{state_code}] Request error: {e}")
            return

        if js.get("code") in ("TOKEN_OR_CAPTCHA_REQUIRED", "INVALID_CAPTCHA"):
            report_bad_captcha(captcha_id)
            continue

        records = []
        data = js.get("data") or {}
        if isinstance(data, list):
            records = data
        else:
            for rec in data.get("records", []):
                records.extend(rec.get("data", []))

        if not records:
            print(f"  State {state_code:3d} → No data")
            return

        states = sorted(set(r.get("state_name","?") for r in records))
        markets = sorted(set(r.get("market_name","?") for r in records))
        print(f"  State {state_code:3d} → {states} | Markets: {markets[:5]}")

        # UP check
        if any("uttar" in s.lower() or "up" == s.lower() for s in states):
            print(f"  *** FOUND UP! State code = {state_code} ***")
            print(f"  All UP markets: {markets}")
        return

    print(f"  State {state_code} — captcha failed")


if __name__ == "__main__":
    print(f"Testing Tomato (ID=65) across state codes: {STATE_CODES_TO_TRY}")
    print(f"Date: {month_ago} → {yesterday}\n")
    for code in STATE_CODES_TO_TRY:
        try_state(code)
    print("\nDone.")
