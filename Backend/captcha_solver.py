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

import captcha_local

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


CAPTCHA_LEN = 6  # Agmarknet ke captcha hamesha 6 character ke hote hain

# Lowercase letters jo capital jitne lambe hote hain — inka case sirf height se
# nahi pata chalta. Tall glyph 26 uppercase vs in 7 lowercase mein se koi ho sakta
# hai, isliye default uppercase rakhte hain (~79% sahi).
_ASCENDER_LOWER = set("bdfhklt")


def fix_case(image_b64: str, answer: str) -> str:
    """
    2Captcha ke lowercase jawab ka case image se theek karo.

    2Captcha `regsense=1` ke bawajood sab lowercase bhejta hai, aur Agmarknet
    case-sensitive hai — isliye har jawab reject hota tha (measured: 6/6 captcha
    mein case galat, letters 4/6 sahi). Yahan har glyph ki height dekh ke tay
    karte hain: chhote (x-height) glyph lowercase, lambe (cap-height) uppercase.

    Fail hone par original answer wapas — kabhi exception nahi phenkta, kyunki
    galat case wala jawab bhi retry loop handle kar leta hai.
    """
    try:
        import base64
        import numpy as np
        import cv2

        raw = base64.b64decode(image_b64.split(",")[-1])
        g = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_GRAYSCALE)
        if g is None:
            return answer

        _, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)

        # Column projection se glyph alag karo (background bilkul saaf hota hai)
        cols = bw.sum(axis=0)
        boxes, in_glyph, start = [], False, 0
        for x, v in enumerate(cols):
            if v > 0 and not in_glyph:
                in_glyph, start = True, x
            elif v == 0 and in_glyph:
                in_glyph = False
                rows = np.where(bw[:, start:x].sum(axis=1) > 0)[0]
                if len(rows):
                    boxes.append((rows.min(), rows.max()))
        if in_glyph:
            rows = np.where(bw[:, start:].sum(axis=1) > 0)[0]
            if len(rows):
                boxes.append((rows.min(), rows.max()))

        # Glyph count answer se match nahi kara to bharosa mat karo
        if len(boxes) != len(answer):
            return answer

        tops = [b[0] for b in boxes]
        cap_top, x_top = min(tops), max(tops)
        if x_top - cap_top < 3:      # sab ek hi height — kuch keh nahi sakte
            return answer
        cutoff = cap_top + (x_top - cap_top) * 0.45

        out = []
        for ch, (top, _) in zip(answer, boxes):
            if not ch.isalpha():
                out.append(ch)
            elif top <= cutoff:
                out.append(ch.upper())
            else:
                out.append(ch.lower())
        return "".join(out)
    except Exception:
        return answer


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
        "regsense": 1,   # mixed-case — par practice mein 2Captcha ise ignore karta
                         # hai aur sab lowercase bhejta hai, isliye fix_case() neeche
        "min_len": CAPTCHA_LEN,  # length hint — bina iske kabhi 5 char aa jate the
        "max_len": CAPTCHA_LEN,
        "language": 2,   # Latin
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


def report_bad_captcha(captcha_id):
    """Tell 2Captcha the answer was wrong — refunds credit + improves accuracy.
    Local solve ka koi 2Captcha id nahi hota, us case mein kuch mat karo."""
    if not captcha_id:
        return
    try:
        requests.get("http://2captcha.com/res.php", params={
            "key": TWOCAPTCHA_API_KEY, "action": "reportbad", "id": captcha_id,
        }, timeout=10)
        print(f"    [captcha] reported bad: {captcha_id}")
    except Exception:
        pass


def get_solved_captcha(max_attempts=5):
    """
    Fetch + solve a captcha. Returns (captcha_key, answer, captcha_id).

    Pehle local template matching try karte hain (captcha_local.py) — woh muft,
    instant aur measured 100% accurate hai. Sirf tab 2Captcha pe jaate hain jab
    local fail kare (font missing, ya glyphs jude hue). captcha_id None hota hai
    local solve pe — tab report_bad_captcha ka koi matlab nahi.
    """
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            captcha_key, image_b64 = fetch_captcha()

            local = captcha_local.solve(image_b64, CAPTCHA_LEN)
            if local:
                return captcha_key, local, None

            captcha_id, answer = solve_captcha(image_b64)
            return captcha_key, fix_case(image_b64, answer), captcha_id
        except Exception as e:
            last_err = e
            print(f"    [captcha] attempt {attempt} failed: {e}")
    raise RuntimeError(f"Captcha solving failed after {max_attempts} attempts: {last_err}")


def is_rate_limited(js: dict) -> bool:
    """
    AGMARKNET rate-limit ko galat captcha se alag karo.

    API dono ke liye same code bhejti hai (TOKEN_OR_CAPTCHA_REQUIRED) —
    farq sirf `detail` mein hota hai:
        galat captcha  -> "Invalid CAPTCHA. Please try again."
        rate limit     -> "Too many requests. Please try again later."

    Rate limit pe captcha sahi hota hai, isliye use bad report NAHI karna
    (solver ka accuracy score aur credits bachte hain) — sirf backoff karo.
    """
    detail = f"{js.get('detail', '')} {js.get('message', '')}".lower()
    return "too many request" in detail or "rate limit" in detail
