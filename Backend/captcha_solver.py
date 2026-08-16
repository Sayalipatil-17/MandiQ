"""
captcha_solver.py — Agmarknet captcha fetch + solve via 2Captcha.

Agmarknet's API now requires a solved captcha (captcha_key + captcha text)
on every daily-price-arrival/report request. This module fetches a fresh
captcha image, sends it to 2Captcha for OCR, and returns the answer.
"""

import os
import time
import requests
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

CAPTCHA_GEN_URL = "https://api.agmarknet.gov.in/v1/captcha/generator"
TWOCAPTCHA_API_KEY = os.environ.get("TWOCAPTCHA_API_KEY", "")

HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}


def fetch_captcha():
    """Fetch a fresh captcha (key + base64 image) from Agmarknet."""
    r = requests.post(CAPTCHA_GEN_URL, headers=HEADERS, json={}, timeout=15)
    r.raise_for_status()
    data = r.json()
    return data["captcha_key"], data["captcha_image"]


def solve_captcha(image_b64, max_wait=90):
    """Send captcha image (base64) to 2Captcha, poll for the text answer.
    Returns (captcha_id, answer) so caller can report bad answers."""
    if not TWOCAPTCHA_API_KEY:
        raise RuntimeError("TWOCAPTCHA_API_KEY not set in .env")

    resp = requests.post("http://2captcha.com/in.php", data={
        "key": TWOCAPTCHA_API_KEY,
        "method": "base64",
        "body": image_b64,
        "regsense": 1,  # Agmarknet captchas are mixed-case
        "json": 1,
    }, timeout=30)
    result = resp.json()
    if result.get("status") != 1:
        raise RuntimeError(f"2Captcha submit failed: {result}")

    captcha_id = result["request"]
    waited = 0
    while waited < max_wait:
        time.sleep(5)
        waited += 5
        res = requests.get("http://2captcha.com/res.php", params={
            "key": TWOCAPTCHA_API_KEY, "action": "get", "id": captcha_id, "json": 1,
        }, timeout=15)
        rj = res.json()
        if rj.get("status") == 1:
            return captcha_id, rj["request"]
        if rj.get("request") != "CAPCHA_NOT_READY":
            raise RuntimeError(f"2Captcha solve failed: {rj}")

    raise RuntimeError("2Captcha timed out waiting for answer")


def report_bad_captcha(captcha_id: str):
    """Tell 2Captcha the answer was wrong — refunds credit + improves accuracy."""
    try:
        requests.get("http://2captcha.com/res.php", params={
            "key": TWOCAPTCHA_API_KEY, "action": "reportbad", "id": captcha_id,
        }, timeout=10)
        print(f"    [captcha] reported bad: {captcha_id}")
    except Exception:
        pass


def get_solved_captcha(max_attempts=5):
    """Fetch + solve a captcha, retrying on 2Captcha errors.
    Returns (captcha_key, answer, captcha_id) — caller uses captcha_id to
    report bad answers back if Agmarknet rejects them."""
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            captcha_key, image_b64 = fetch_captcha()
            captcha_id, answer = solve_captcha(image_b64)
            return captcha_key, answer, captcha_id
        except Exception as e:
            last_err = e
            print(f"    [captcha] attempt {attempt} failed: {e}")
    raise RuntimeError(f"Captcha solving failed after {max_attempts} attempts: {last_err}")
