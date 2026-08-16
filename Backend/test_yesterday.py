"""Test scraper with yesterday's date to confirm it works."""
import requests, time, os, base64
from captcha_solver import get_solved_captcha, report_bad_captcha
from dotenv import load_dotenv
load_dotenv(".env")

HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

def try_date(date_str, crop_name="Tomato", commodity_id="65"):
    print(f"\nTrying {crop_name} on {date_str}...")
    body = {
        "data_type": "100006", "commodity": commodity_id, "group": "6",
        "state": "[25]", "district": "[100001]", "variety": "[100007]",
        "grade": "[100003]", "market": "[100002]",
        "from_date": date_str, "to_date": date_str,
        "page": "1", "limit": "50",
    }
    for attempt in range(5):
        try:
            captcha_key, answer, cid = get_solved_captcha()
            print(f"  Attempt {attempt+1}: solved={answer}")
        except Exception as e:
            print(f"  Attempt {attempt+1}: solve failed: {e}")
            continue
        body["captcha_key"] = captcha_key
        body["captcha"] = answer
        try:
            r = requests.post("https://api.agmarknet.gov.in/v1/daily-price-arrival/report",
                              json=body, headers=HEADERS, timeout=60)
            js = r.json()
        except Exception as e:
            print(f"  Request failed: {e}")
            continue
        code = js.get("code", "")
        if code in ("TOKEN_OR_CAPTCHA_REQUIRED", "INVALID_CAPTCHA"):
            report_bad_captcha(cid)
            print(f"  => Captcha rejected, retry")
            continue
        print(f"  => code={code} status={js.get('status')} msg={js.get('message')}")
        recs = js.get("data", {}).get("records", [])
        print(f"  => Records: {len(recs)}")
        if recs:
            for rec in recs[:3]:
                rows = rec.get("data", [])
                for row in rows[:2]:
                    print(f"     {row.get('market_name')} | {row.get('arrival_date')} | modal={row.get('model_price')}")
        return True
    print("  All attempts failed")
    return False

import datetime
today = datetime.date.today()
yesterday = (today - datetime.timedelta(days=1)).isoformat()
day_before = (today - datetime.timedelta(days=2)).isoformat()

try_date(yesterday)
try_date(day_before)
try_date("2026-08-10")  # last Monday
