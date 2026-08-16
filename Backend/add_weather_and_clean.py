"""
add_weather_and_clean.py
Apne backend folder mein rakho aur chalao:
    python add_weather_and_clean.py

Input:  All_Type_of_Report CSV (Potato/Onion/Spinach)
Output: data/Potato_Clean_data.csv, data/Onion_Clean_data.csv, data/Spinach_Clean_data.csv
"""

import pandas as pd
import numpy as np
import requests
import time
import os

CSV_INPUT = "All_Type_of_Report_(All_Grades)_04-07-2026_06-33-47_PM.csv"
OUTPUT_DIR = "data"

PRODUCING_REGION = {
    "Potato": {1:"agra",2:"agra",3:"agra",4:"agra",5:"agra",6:"solan",7:"solan",8:"solan",9:"agra",10:"agra",11:"agra",12:"agra"},
    "Onion":  {m:"nashik" for m in range(1,13)},
    "Spinach":{1:"agra",2:"agra",3:"agra",4:"solan",5:"solan",6:"solan",7:"agra",8:"agra",9:"agra",10:"agra",11:"agra",12:"agra"},
}
REGION_COORDS = {
    "agra":   (27.18, 78.02),
    "solan":  (30.90, 77.10),
    "nashik": (19.99, 73.79),
}
CROP_LAG = {"Potato":6, "Onion":6, "Spinach":1}
SEASON_MAP = {12:"winter",1:"winter",2:"winter",3:"summer",4:"summer",5:"summer",
              6:"monsoon",7:"monsoon",8:"monsoon",9:"monsoon",10:"post_monsoon",11:"post_monsoon"}
DELHI = (28.66, 77.21)


def fetch_weather(lat, lon, start, end, prefix):
    url = (f"https://archive-api.open-meteo.com/v1/archive?"
           f"latitude={lat}&longitude={lon}&start_date={start}&end_date={end}"
           f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean"
           f"&timezone=Asia/Kolkata")
    try:
        js = requests.get(url, timeout=60).json().get("daily", {})
        return pd.DataFrame({
            "date": pd.to_datetime(js["time"]),
            f"{prefix}_temp_max": js["temperature_2m_max"],
            f"{prefix}_temp_min": js["temperature_2m_min"],
            f"{prefix}_rainfall": js["precipitation_sum"],
            f"{prefix}_humidity": js["relative_humidity_2m_mean"],
        })
    except Exception as e:
        print(f"  Weather error {prefix}: {e}")
        return pd.DataFrame()


# Load
df = pd.read_csv(CSV_INPUT, skiprows=1)
df.columns = ['state','district','market','commodity_grp','commodity','date',
              'arrival_qty_mt','arrival_unit','modal_price_rs_quintal','price_unit']
df = df.dropna(subset=['commodity','market','date','modal_price_rs_quintal'])
df['date'] = pd.to_datetime(df['date'], dayfirst=True, errors='coerce')
df = df.dropna(subset=['date'])
df['market'] = df['market'].str.replace('APMC ','').str.strip() + ' APMC'
df['modal_price_rs_quintal'] = pd.to_numeric(df['modal_price_rs_quintal'], errors='coerce')
df['arrival_qty_mt'] = pd.to_numeric(df['arrival_qty_mt'], errors='coerce')

FROM = df['date'].min().strftime("%Y-%m-%d")
TO   = df['date'].max().strftime("%Y-%m-%d")
print(f"Data: {len(df)} rows | {FROM} → {TO}")

# Fetch Delhi weather
print("Fetching Delhi weather...")
delhi_w = fetch_weather(DELHI[0], DELHI[1], FROM, TO, "delhi")
print(f"  Delhi: {len(delhi_w)} days")

# Fetch region weather
region_weather = {}
for region, coords in REGION_COORDS.items():
    print(f"Fetching {region} weather...")
    region_weather[region] = fetch_weather(coords[0], coords[1], FROM, TO, "r")
    print(f"  {region}: {len(region_weather[region])} days")
    time.sleep(0.5)

# Add calendar features
df['month'] = df['date'].dt.month
df['season'] = df['month'].map(SEASON_MAP)
df['producing_region'] = df.apply(
    lambda r: PRODUCING_REGION.get(r['commodity'], {}).get(r['month'], 'agra'), axis=1)

# Merge Delhi weather
if not delhi_w.empty:
    df = df.merge(delhi_w, on="date", how="left")
else:
    for c in ['delhi_temp_max','delhi_temp_min','delhi_rainfall','delhi_humidity']:
        df[c] = np.nan

# Add lagged region weather
def get_region_w(row):
    lag = CROP_LAG.get(row['commodity'], 4)
    lagged_date = row['date'] - pd.Timedelta(days=lag)
    rdf = region_weather.get(row['producing_region'])
    if rdf is not None and not rdf.empty:
        match = rdf[rdf['date'] == lagged_date]
        if not match.empty:
            return match.iloc[0][['r_temp_max','r_temp_min','r_rainfall','r_humidity']].values
    return [np.nan, np.nan, np.nan, np.nan]

print("Adding region weather (this takes a moment)...")
rw = df.apply(get_region_w, axis=1, result_type='expand')
rw.columns = ['region_temp_max','region_temp_min','region_rainfall','region_humidity']
df = pd.concat([df, rw], axis=1)

# Ffill missing weather
for c in ['delhi_temp_max','delhi_temp_min','delhi_rainfall','delhi_humidity',
          'region_temp_max','region_temp_min','region_rainfall','region_humidity']:
    df[c] = df[c].ffill().bfill()

# Final schema
cols = ['date','market','arrival_qty_mt','modal_price_rs_quintal','month','season',
        'producing_region','delhi_temp_max','delhi_temp_min','delhi_rainfall',
        'delhi_humidity','region_temp_max','region_temp_min','region_rainfall','region_humidity']

df = df.drop_duplicates(subset=['date','market','commodity'], keep='last')
df = df.sort_values(['commodity','market','date']).reset_index(drop=True)

os.makedirs(OUTPUT_DIR, exist_ok=True)
for crop, grp in df.groupby('commodity'):
    out = grp[cols].reset_index(drop=True)
    path = os.path.join(OUTPUT_DIR, f"{crop}_Clean_data.csv")
    out.to_csv(path, index=False)
    print(f"\n{crop}: {len(out)} rows → {path}")
    for mkt, mg in out.groupby('market'):
        print(f"  {mkt}: {mg['date'].min().date()} → {mg['date'].max().date()} ({len(mg)})")

print("\nDONE ✓")