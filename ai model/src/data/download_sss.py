"""
Download Copernicus Marine Sea Surface Salinity (SSS) data
for a region and date range, matching the SST/SSHa grids.

Dataset confirmed via `copernicusmarine describe --contains "cmems_obs-mob_glo_phy-sss_my"`:
cmems_obs-mob_glo_phy-sss_my_multi_P1D (daily, historical/reprocessed, 0.125 deg)

Requires: pip install copernicusmarine
Requires: `copernicusmarine login` run once beforehand
"""

import copernicusmarine
from pathlib import Path
import yaml


def load_region_config(config_path="config/region.yaml"):
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def download_sss_range(start_date, end_date, region_config, out_dir="data/raw/sss"):
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    lat_min, lat_max = region_config["lat_min"], region_config["lat_max"]
    lon_min, lon_max = region_config["lon_min"], region_config["lon_max"]

    out_file = out_path / f"sss_{start_date}_{end_date}.nc"

    print(f"Downloading SSS for {start_date} to {end_date}...")

    copernicusmarine.subset(
        dataset_id="cmems_obs-mob_glo_phy-sss_my_multi_P1D",
        variables=["sos"],  # sea surface salinity
        minimum_longitude=lon_min,
        maximum_longitude=lon_max,
        minimum_latitude=lat_min,
        maximum_latitude=lat_max,
        start_datetime=f"{start_date}T00:00:00",
        end_datetime=f"{end_date}T23:59:59",
        output_filename=str(out_file),
    )

    print(f"Saved SSS data to {out_file}")
    return out_file


if __name__ == "__main__":
    region = load_region_config()
    download_sss_range(start_date="2023-01-01", end_date="2024-01-01", region_config=region)   