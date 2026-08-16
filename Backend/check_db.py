from database import MandiDB
db = MandiDB()

markets = ['Azadpur APMC', 'Keshopur APMC', 'Shahdara APMC']

for crop in ['Tomato', 'Potato', 'Onion', 'Spinach']:
    print(f"\n{'='*55}")
    print(f"  {crop}")
    print(f"{'='*55}")
    for market in markets:
        data = db.get_data(commodity=crop, market=market, start='2026-08-01', end='2026-08-12')
        if not data:
            print(f"  {market}: no data")
            continue
        print(f"  {market}:")
        for r in data:
            print(f"    {r['date']} | Rs.{r['modal_price']}/quintal | arrival={r['arrival_qty']}MT")
