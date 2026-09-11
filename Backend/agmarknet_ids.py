"""
agmarknet_ids.py — AGMARKNET ke saare dropdown IDs (commodity/state/district/market/variety)
ek hi public endpoint se. Koi captcha nahi lagta.

    GET https://api.agmarknet.gov.in/v1/daily-price-arrival/filters

Usage:
    python agmarknet_ids.py tomato          # commodity dhundo
    python agmarknet_ids.py --state uttar   # state dhundo
    python agmarknet_ids.py --market prayagraj --state 34
    python agmarknet_ids.py --dump          # data/agmarknet_filters.json refresh karo
"""
import sys, os, json, requests as req

FILTERS_URL = "https://api.agmarknet.gov.in/v1/daily-price-arrival/filters"
HEADERS = {
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": "Mozilla/5.0",
}
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "agmarknet_filters.json")


def load(refresh: bool = False) -> dict:
    if refresh or not os.path.exists(CACHE):
        r = req.get(FILTERS_URL, headers=HEADERS, timeout=60)
        r.raise_for_status()
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump(r.json(), f, ensure_ascii=False, indent=1)
    with open(CACHE, encoding="utf-8") as f:
        return json.load(f)["data"]


def _search(rows, name_key, id_key, term, extra=None):
    term = term.lower()
    for row in rows:
        name = str(row.get(name_key) or "")
        if term in name.lower():
            if extra and not extra(row):
                continue
            print(f"  {row.get(id_key):>7}  {name}")


def main():
    args = sys.argv[1:]
    refresh = "--dump" in args
    d = load(refresh)
    if refresh:
        print(f"Saved -> {CACHE}")
        args = [a for a in args if a != "--dump"]
        if not args:
            for k, v in d.items():
                print(f"  {k}: {len(v) if isinstance(v, list) else 1}")
            return

    def opt(flag):
        return args[args.index(flag) + 1] if flag in args else None

    state = opt("--state")
    if opt("--market") is not None:
        sid = int(state) if state and state.isdigit() else None
        print("Markets:")
        _search(d["market_data"], "mkt_name", "id", opt("--market"),
                extra=(lambda r: r.get("state_id") == sid) if sid else None)
    elif opt("--district") is not None:
        sid = int(state) if state and state.isdigit() else None
        print("Districts:")
        _search(d["district_data"], "district_name", "id", opt("--district"),
                extra=(lambda r: r.get("state_id") == sid) if sid else None)
    elif state is not None:
        print("States:")
        _search(d["state_data"], "state_name", "state_id", state)
    elif opt("--variety") is not None:
        print("Varieties:")
        _search(d["variety_data"], "variety_name", "id", opt("--variety"))
    elif args:
        print("Commodities:")
        for row in d["cmdt_data"]:
            if args[0].lower() in row["cmdt_name"].lower():
                print(f"  {row['cmdt_id']:>7}  {row['cmdt_name']}  (group {row['cmdt_group_id']})")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
