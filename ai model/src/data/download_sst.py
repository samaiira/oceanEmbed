"""
Download NOAA OISST v2.1 daily sea surface temperature data for a region/date range.

Uses direct HTTPS file download (NOT OpenDAP/dodsC) because NCEI's THREDDS OpenDAP
endpoint is unreliable for scripted/bulk access and frequently throws
"NetCDF: I/O failure" errors under repeated automated requests.

Files are downloaded to a local temp cache (full global grid, ~a few MB/day),
then cropped to the target region with xarray and discarded.
"""

import requests
import xarray as xr
from pathlib import Path
import pandas as pd
import yaml
import tempfile
import os

# Direct file access base (NOT the /thredds/dodsC/ OpenDAP path)
OISST_FILE_URL_TEMPLATE = (
    "https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/"
    "v2.1/access/avhrr/{year}{month:02d}/oisst-avhrr-v02r01.{year}{month:02d}{day:02d}.nc"
)


def load_region_config(config_path="config/region.yaml"):
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def download_single_day(date, tmp_dir, max_retries=3):
    """Download one day's global OISST file to a local temp path. Returns the local path or None."""
    url = OISST_FILE_URL_TEMPLATE.format(year=date.year, month=date.month, day=date.day)
    local_path = Path(tmp_dir) / f"oisst_{date.strftime('%Y%m%d')}.nc"

    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.get(url, timeout=60)
            resp.raise_for_status()
            with open(local_path, "wb") as f:
                f.write(resp.content)
            return local_path
        except requests.exceptions.RequestException as e:
            print(f"  attempt {attempt}/{max_retries} failed for {date.date()}: {e}")
            if attempt == max_retries:
                return None


def download_sst_range(start_date, end_date, region_config, out_dir="data/raw/sst"):
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    lat_min, lat_max = region_config["lat_min"], region_config["lat_max"]
    lon_min, lon_max = region_config["lon_min"], region_config["lon_max"]

    dates = pd.date_range(start_date, end_date, freq="D")
    all_days = []

    with tempfile.TemporaryDirectory() as tmp_dir:
        for date in dates:
            print(f"Fetching SST for {date.date()} ...")
            local_file = download_single_day(date, tmp_dir)

            if local_file is None:
                print(f"  SKIPPED {date.date()} — download failed after retries")
                continue

            try:
                ds = xr.open_dataset(local_file)
                # OISST lon is 0-360; region_config values (45-105) already match this convention
                ds_region = ds.sel(
                    lat=slice(lat_min, lat_max),
                    lon=slice(lon_min, lon_max)
                )
                all_days.append(ds_region[["sst"]].load())  # .load() so we can discard the temp file safely
                ds.close()
            except Exception as e:
                print(f"  ERROR processing {date.date()}: {e}")
            finally:
                os.remove(local_file)  # clean up temp file immediately, don't let temp dir grow

    if all_days:
        combined = xr.concat(all_days, dim="time")
        out_file = out_path / f"sst_{start_date}_{end_date}.nc"
        combined.to_netcdf(out_file)
        print(f"\nSaved combined SST file to {out_file} ({len(all_days)}/{len(dates)} days retrieved)")
        return combined
    else:
        print("\nNo SST data retrieved.")
        return None


if __name__ == "__main__":
    region = load_region_config()

    download_sst_range(
        start_date="2023-01-01",
        end_date="2024-01-01",
        region_config=region,
    )