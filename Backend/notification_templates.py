"""
Push notification templates for MandiQ.

Har alert type ke 10 variations — har baar randomly ek chuna jata hai
taaki farmer ko har notification fresh lage, robotic na lage.

Placeholders:
    {crop}   - fasal ka naam        (e.g. Onion)
    {market} - mandi ka naam        (e.g. Azadpur APMC)
    {price}  - aaj ka bhav (int)    (e.g. 2150)
    {target} - farmer ka target     (e.g. 2000)
    {diff}   - target se antar      (e.g. 150)
"""

import random
from typing import Tuple

# ── ABOVE: bhav target tak pahunch gaya / cross kar gaya → BECHO ────────────
ABOVE_TEMPLATES = [
    ("🌾 MandiQ — Bhav Mil Gaya!",
     "{crop} ka bhav ₹{price}/quintal ho gaya! Aapka target ₹{target} tha ✅ {market} mein ab becho."),

    ("🎯 Target Pura Hua!",
     "{crop} ₹{price}/quintal pahunch gaya — target se ₹{diff} zyada! {market} mein bechne ka sahi waqt."),

    ("📈 {crop} ka Bhav Chadha!",
     "{market} mein aaj ₹{price}/quintal. Aapne ₹{target} pe alert lagaya tha — ab becho!"),

    ("✅ Aapka Alert Trigger Hua",
     "{crop} ₹{price}/quintal — target ₹{target} cross ho gaya. {market} mein bhav accha hai."),

    ("💰 Achha Bhav Aaya Hai",
     "{crop} ka rate {market} mein ₹{price}/quintal. ₹{diff} target se upar — der mat karo!"),

    ("🔔 Bechne ka Waqt Aa Gaya",
     "{crop} ₹{price}/quintal pe chal raha hai {market} mein. Aapka ₹{target} ka target pura ✅"),

    ("🚜 {crop} — Sahi Rate Mil Raha Hai",
     "Aaj {market} mein ₹{price}/quintal. Target ₹{target} se ₹{diff} zyada. Ab bech dijiye!"),

    ("📊 Bhav Target ke Upar",
     "{crop} ka modal price ₹{price}/quintal ho gaya ({market}). Aapka target tha ₹{target}."),

    ("⚡ Alert: {crop} Bhav Badha",
     "{market} mein {crop} ₹{price}/quintal — ₹{diff} ka faayda target se. Bechne ka mauka!"),

    ("🌟 Mauka Haath Se Na Jaye",
     "{crop} aaj ₹{price}/quintal ({market}). Aapne ₹{target} pe alert set kiya tha — pura hua!"),
]

# ── BELOW: bhav target tak gir gaya → KHARIDO / RUKO ────────────────────────
BELOW_TEMPLATES = [
    ("📉 MandiQ — Bhav Gir Gaya",
     "{crop} ka bhav ₹{price}/quintal aa gaya {market} mein. Aapka target ₹{target} tha ✅"),

    ("🎯 Neeche ka Target Pura",
     "{crop} ₹{price}/quintal — target ₹{target} se ₹{diff} kam. {market} mein kharidne ka mauka."),

    ("🔻 {crop} ka Rate Kam Hua",
     "{market} mein aaj ₹{price}/quintal. Aapne ₹{target} pe alert lagaya tha — ab dekh lijiye."),

    ("✅ Aapka Alert Trigger Hua",
     "{crop} ₹{price}/quintal pe aa gaya ({market}). Target ₹{target} — abhi bechna theek nahi."),

    ("⚠️ Bhav Neeche Aaya",
     "{crop} ka rate {market} mein ₹{price}/quintal. ₹{diff} target se kam — thoda ruk jaiye."),

    ("🔔 {crop} Bhav Update",
     "{market} mein {crop} ₹{price}/quintal ho gaya. Aapka ₹{target} ka target hit hua."),

    ("📊 Rate Girke Target Pe",
     "{crop} ka modal price ₹{price}/quintal ({market}). Aapne ₹{target} pe watch lagaya tha."),

    ("🛒 Kharidne ka Waqt",
     "{crop} sasta hua — ₹{price}/quintal {market} mein. Target ₹{target} se ₹{diff} neeche."),

    ("⏳ Abhi Bechna Theek Nahi",
     "{crop} ₹{price}/quintal pe hai ({market}). Bhav gir raha hai — thoda intezaar karein."),

    ("📩 Bhav Alert: {crop}",
     "{market} mein {crop} ka rate ₹{price}/quintal. Aapka target ₹{target} tha — pura ho gaya."),
]

# ── BEST DAY: AI forecast kehta hai aaj bechne ka best din hai ──────────────
BEST_DAY_TEMPLATES = [
    ("🌾 MandiQ — Aaj Best Din Hai!",
     "AI ke hisaab se {crop} bechne ka aaj sabse accha din. {market}: ₹{price}/quintal."),

    ("⭐ Aaj Bech Dijiye",
     "{crop} ka bhav aaj peak pe — ₹{price}/quintal {market} mein. Aage girne ka anuman."),

    ("📈 Peak Price Aa Gaya",
     "{crop} ₹{price}/quintal ({market}). Agle 7 din mein isse behtar rate milne ka chance kam."),

    ("🎯 Sahi Waqt — Aaj",
     "MandiQ AI: {crop} ke liye aaj best selling day. {market} mein ₹{price}/quintal chal raha hai."),

    ("🚜 Der Mat Kijiye",
     "{crop} aaj ₹{price}/quintal pe hai {market} mein — forecast ke mutabik yahi peak hai."),

    ("💡 AI Salah: Aaj Becho",
     "{crop} ka rate ₹{price}/quintal ({market}). Hamara model kehta hai aaj bechna faaydemand."),

    ("🌟 Best Day Alert",
     "Aaj {crop} bechne ka sabse accha mauka — {market} mein ₹{price}/quintal."),

    ("📊 Forecast Peak",
     "{crop} ₹{price}/quintal pe aaj top pe ({market}). Aage 7 din mein neeche jaane ka anuman."),

    ("⚡ Aaj ka Bhav Sabse Upar",
     "{market} mein {crop} ₹{price}/quintal — is hafte ka sabse accha rate. Ab bech dijiye!"),

    ("🔔 MandiQ Best Day",
     "AI forecast: {crop} ke liye aaj sell karna best. {market}: ₹{price}/quintal."),
]

_BUCKETS = {
    "above": ABOVE_TEMPLATES,
    "below": BELOW_TEMPLATES,
    "best_day": BEST_DAY_TEMPLATES,
}


def build_message(kind: str, crop: str, market: str, price: float,
                  target: float = 0.0) -> Tuple[str, str]:
    """
    Randomly ek template chunke (title, body) return karta hai.

    kind: "above" | "below" | "best_day"
    """
    templates = _BUCKETS.get(kind, ABOVE_TEMPLATES)
    title_tpl, body_tpl = random.choice(templates)

    fields = {
        "crop": crop,
        "market": market.replace(" APMC", " Mandi"),
        "price": int(round(price)),
        "target": int(round(target)),
        "diff": int(abs(round(price - target))),
    }
    return title_tpl.format(**fields), body_tpl.format(**fields)
