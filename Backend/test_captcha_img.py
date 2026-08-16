import requests, base64, os, time
from dotenv import load_dotenv
load_dotenv(".env")
api_key = os.environ.get("TWOCAPTCHA_API_KEY", "")

HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

# Fetch captcha
r = requests.post("https://api.agmarknet.gov.in/v1/captcha/generator", headers=HEADERS, json={}, timeout=15)
data = r.json()
captcha_key = data["captcha_key"]
image_b64 = data["captcha_image"]

print(f"captcha_key: {captcha_key}")
print(f"image b64 length: {len(image_b64)}")
print(f"image b64 prefix: {image_b64[:50]}")

# Save image
img_bytes = base64.b64decode(image_b64)
with open("captcha_live.png", "wb") as f:
    f.write(img_bytes)
print("Saved: captcha_live.png")

# Submit to 2captcha
resp = requests.post("http://2captcha.com/in.php", data={
    "key": api_key, "method": "base64", "body": image_b64,
    "regsense": 1, "json": 1,
}, timeout=30)
result = resp.json()
print(f"Submit: {result}")

if result.get("status") == 1:
    cid = result["request"]
    print(f"Waiting for solve... ID={cid}")
    for i in range(18):
        time.sleep(5)
        res = requests.get("http://2captcha.com/res.php", params={
            "key": api_key, "action": "get", "id": cid, "json": 1
        }, timeout=15)
        rj = res.json()
        print(f"  [{(i+1)*5}s] {rj}")
        if rj.get("status") == 1:
            answer = rj["request"]
            print(f"\nSOLVED: {answer}")

            # Now test with Agmarknet
            body = {
                "data_type": "100006", "commodity": "65", "group": "6",
                "state": "[25]", "district": "[100001]", "variety": "[100007]",
                "grade": "[100003]", "market": "[100002]",
                "from_date": "2026-08-13", "to_date": "2026-08-13",
                "page": "1", "limit": "50",
                "captcha_key": captcha_key, "captcha": answer,
            }
            r2 = requests.post("https://api.agmarknet.gov.in/v1/daily-price-arrival/report",
                               json=body, headers=HEADERS, timeout=90)
            print(f"Agmarknet response: {r2.json()}")
            break
        if rj.get("request") != "CAPCHA_NOT_READY":
            print("Error from 2captcha")
            break
