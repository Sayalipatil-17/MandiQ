"""
Test if Agmarknet needs cookies/session from browser visit first.
Also test case variations of captcha answer.
"""
import requests, time, os
from dotenv import load_dotenv
load_dotenv(".env")

API_KEY = os.environ.get("TWOCAPTCHA_API_KEY", "")

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
})

# Step 1: Visit main site to get cookies
print("Step 1: Visiting agmarknet.gov.in to get cookies...")
try:
    r = session.get("https://agmarknet.gov.in/", timeout=15)
    print(f"  Status: {r.status_code}, Cookies: {dict(session.cookies)}")
except Exception as e:
    print(f"  Failed (ok, continuing): {e}")

# Step 2: Fetch captcha using session
print("\nStep 2: Fetching captcha...")
r = session.post("https://api.agmarknet.gov.in/v1/captcha/generator", json={}, timeout=15)
data = r.json()
captcha_key = data["captcha_key"]
image_b64 = data["captcha_image"]
print(f"  captcha_key: {captcha_key}")

# Save image to see it
import base64
img_bytes = base64.b64decode(image_b64)
with open("captcha_session.png", "wb") as f:
    f.write(img_bytes)
print("  Saved: captcha_session.png")

# Step 3: Solve via 2Captcha
print("\nStep 3: Solving via 2Captcha...")
resp = requests.post("http://2captcha.com/in.php", data={
    "key": API_KEY, "method": "base64", "body": image_b64,
    "regsense": 1, "json": 1,
}, timeout=30)
result = resp.json()
print(f"  Submit: {result}")
cid = result["request"]

for i in range(20):
    time.sleep(5)
    res = requests.get("http://2captcha.com/res.php", params={
        "key": API_KEY, "action": "get", "id": cid, "json": 1
    }, timeout=15)
    rj = res.json()
    if rj.get("status") == 1:
        answer = rj["request"]
        print(f"  Solved in {(i+1)*5}s: [{answer}]")
        break
    print(f"  [{(i+1)*5}s] not ready")
else:
    print("  Timeout"); exit(1)

# Step 4: Try all case variations
print("\nStep 4: Testing case variations with Agmarknet...")
variations = [answer, answer.lower(), answer.upper()]
print(f"  Trying: {variations}")

body = {
    "data_type": "100006", "commodity": "65", "group": "6",
    "state": "[25]", "district": "[100001]", "variety": "[100007]",
    "grade": "[100003]", "market": "[100002]",
    "from_date": "2026-08-13", "to_date": "2026-08-13",
    "page": "1", "limit": "50",
    "captcha_key": captcha_key,
}

for var in variations:
    body["captcha"] = var
    r2 = session.post("https://api.agmarknet.gov.in/v1/daily-price-arrival/report", json=body, timeout=90)
    js = r2.json()
    code = js.get("code", "")
    status = js.get("status")
    msg = js.get("message", "")
    print(f"  [{var}] => code={code} status={status} msg={msg}")
    if code not in ("TOKEN_OR_CAPTCHA_REQUIRED", "INVALID_CAPTCHA"):
        print("  ✓ PASSED!")
        recs = js.get("data", {}).get("records", [])
        print(f"  Records: {len(recs)}")
        break
    time.sleep(1)
