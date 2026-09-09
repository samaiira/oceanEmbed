"""
Download Argo float profiles for a given region and date range using the Argovis API.
Saves results as a CSV with columns: float_id, date, lat, lon, pressure, temperature, salinity

NOTE: Argovis requires a free API key for most queries.
Register at: https://argovis-keygen.colorado.edu
Set it as an environment variable ARGOVIS_API_KEY before running this script.
"""

import requests
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
import time
import yaml
import os


ARGOVIS_BASE_URL = "https://argovis-api.colorado.edu/argo"


def load_region_config(config_path="config/region.yaml"):
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def fetch_argo_profiles(lat_min, lat_max, lon_min, lon_max, start_date, end_date, api_key=None):
    """
    Query Argovis for profiles within a bounding box and date range.
    Requests actual pressure/temperature/salinity data values (not just metadata).
    """
    polygon = f"[[{lon_min},{lat_min}],[{lon_max},{lat_min}],[{lon_max},{lat_max}],[{lon_min},{lat_max}],[{lon_min},{lat_min}]]"

    params = {
        "startDate": start_date,
        "endDate": end_date,
        "polygon": polygon,
        "data": "pressure,temperature,salinity",
    }

    headers = {}
    if api_key:
        headers["x-argokey"] = api_key

    response = requests.get(ARGOVIS_BASE_URL, params=params, headers=headers, timeout=60)

    if response.status_code != 200:
        print(f"  HTTP {response.status_code} — {response.text[:300]}")
    response.raise_for_status()
    return response.json()


def parse_profiles_to_df(profiles_json):
    """
    Flatten Argovis JSON response into a tidy dataframe:
    one row per (float, date, depth level).

    Argovis returns "data" as parallel arrays in the order requested
    (we request "pressure,temperature,salinity"), so:
        data[0] = pressure values
        data[1] = temperature values
        data[2] = salinity values
    """
    rows = []
    for profile in profiles_json:
        float_id = profile.get("_id", "unknown")
        lat = profile.get("geolocation", {}).get("coordinates", [None, None])[1]
        lon = profile.get("geolocation", {}).get("coordinates", [None, None])[0]
        date = profile.get("timestamp")

        data = profile.get("data", [])
        if not data or len(data) < 3:
            continue

        pressures = data[0]
        temperatures = data[1]
        salinities = data[2]

        for pres, temp, sal in zip(pressures, temperatures, salinities):
            rows.append({
                "float_id": float_id,
                "date": date,
                "lat": lat,
                "lon": lon,
                "pressure": pres,
                "temperature": temp,
                "salinity": sal,
            })
    return pd.DataFrame(rows)


def download_argo_range(start_date, end_date, region_config, out_dir="data/raw/argo", api_key=None, chunk_days=7):
    """
    Downloads in weekly chunks to avoid overly large single requests.
    """
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    lat_min, lat_max = region_config["lat_min"], region_config["lat_max"]
    lon_min, lon_max = region_config["lon_min"], region_config["lon_max"]

    current = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    all_dfs = []

    while current < end:
        chunk_end = min(current + timedelta(days=chunk_days), end)
        print(f"Fetching Argo profiles: {current.date()} to {chunk_end.date()}")

        try:
            profiles = fetch_argo_profiles(
                lat_min, lat_max, lon_min, lon_max,
                current.isoformat() + "Z", chunk_end.isoformat() + "Z",
                api_key=api_key
            )
            df = parse_profiles_to_df(profiles)
            print(f"  -> {len(df)} rows, {df['float_id'].nunique() if not df.empty else 0} floats")
            all_dfs.append(df)
        except requests.exceptions.RequestException as e:
            print(f"  ERROR fetching {current.date()}-{chunk_end.date()}: {e}")

        current = chunk_end
        time.sleep(1)

    if all_dfs:
        final_df = pd.concat(all_dfs, ignore_index=True)
        out_file = out_path / f"argo_{start_date}_{end_date}.csv"
        final_df.to_csv(out_file, index=False)
        print(f"\nSaved {len(final_df)} rows to {out_file}")
        return final_df
    else:
        print("\nNo data retrieved.")
        return pd.DataFrame()


if __name__ == "__main__":
    region = load_region_config()

    ARGOVIS_API_KEY = os.environ.get("ARGOVIS_API_KEY", None)

    if ARGOVIS_API_KEY is None:
        print("WARNING: No ARGOVIS_API_KEY found in environment.")
        print("Register for a free key at https://argovis-keygen.colorado.edu")
        print("Then set it as an environment variable before running this script.\n")

    download_argo_range(
        start_date="2023-01-01",
        end_date="2024-01-01",
        region_config=region,
        api_key=ARGOVIS_API_KEY,
    )