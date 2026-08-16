import requests
from captcha_solver import get_solved_captcha

key, answer = get_solved_captcha()
print(f"Captcha solved: {answer}")

body = {
    "data_type": "100006", "commodity": "65", "group": "6",
    "state": "[25]", "district": "[100001]", "variety": "[100007]",
    "grade": "[100003]", "market": "[100002]",
    "from_date": "2026-08-13", "to_date": "2026-08-13",
    "page": "1", "limit": "50",
    "captcha_key": key, "captcha": answer,
}
headers = {
    "Content-Type": "application/json",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0",
}
r = requests.post("https://api.agmarknet.gov.in/v1/daily-price-arrival/report", json=body, headers=headers, timeout=90)
js = r.json()
print(f"HTTP: {r.status_code}")
print(f"code: {js.get('code')}")
print(f"status: {js.get('status')}")
print(f"message: {js.get('message')}")
if js.get("data"):
    recs = js["data"].get("records", [])
    print(f"records: {len(recs)}")
    for rec in recs[:2]:
        print(rec)
