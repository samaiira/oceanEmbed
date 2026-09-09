"""
Download Copernicus Marine Sea Surface Currents (U, V) data.

Dataset confirmed via `copernicusmarine describe --contains "cmems_obs-mob_glo_phy-cur_my"`:
cmems_obs-mob_glo_phy-cur_my_0.25deg_PT1H-i (hourly, historical, 0.25 deg)

Since this product is hourly (not daily like our other variables), we download
the full hourly range and resample to a daily mean locally to match the
SST/SSHa/SSS grids.
"""

import copernicusmarine
import xarray as xr
from pathlib import Path
import yaml


def load_region_config(config_path="config/region.yaml"):
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def download_currents_range(start_date, end_date, region_config, out_dir="data/raw/currents"):
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    lat_min, lat_max = region_config["lat_min"], region_config["lat_max"]
    lon_min, lon_max = region_config["lon_min"], region_config["lon_max"]

    hourly_file = out_path / f"currents_hourly_{start_date}_{end_date}.nc"
    daily_file = out_path / f"currents_{start_date}_{end_date}.nc"

    print(f"Downloading hourly currents for {start_date} to {end_date}...")

    copernicusmarine.subset(
        dataset_id="cmems_obs-mob_glo_phy-cur_my_0.25deg_PT1H-i",
        variables=["uo", "vo"],
        minimum_longitude=lon_min,
        maximum_longitude=lon_max,
        minimum_latitude=lat_min,
        maximum_latitude=lat_max,
        start_datetime=f"{start_date}T00:00:00",
        end_datetime=f"{end_date}T23:59:59",
        output_filename=str(hourly_file),
    )

    print(f"Downloaded hourly data to {hourly_file}")
    print("Resampling to daily mean...")

    ds = xr.open_dataset(hourly_file)
    ds_daily = ds.resample(time="1D").mean()
    ds_daily.to_netcdf(daily_file)

    print(f"Saved daily-resampled currents to {daily_file}")
    return daily_file


if __name__ == "__main__":
    region = load_region_config()
    download_currents_range(start_date="2023-01-01", end_date="2023-02-01", region_config=region)