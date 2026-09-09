"""
Phase 2: Regrid all satellite variables onto one common grid.
"""

import xarray as xr
import numpy as np
from pathlib import Path


def load_all_raw(data_dir="data/raw"):
    data_dir = Path(data_dir)

    sst = xr.open_dataset(data_dir / "sst/sst_2023-01-01_2024-01-01.nc").sst.squeeze("zlev", drop=True)
    ssha = xr.open_dataset(data_dir / "ssha/ssha_2023-01-01_2024-01-01.nc").sla
    sss = xr.open_dataset(data_dir / "sss/sss_2023-01-01_2024-01-01.nc").sos.squeeze("depth", drop=True)

    for da in [sst, ssha, sss]:
        da["time"] = da["time"].dt.floor("D")

    print(f"SST grid:  {dict(sst.sizes)}")
    print(f"SSHa grid: {dict(ssha.sizes)}")
    print(f"SSS grid:  {dict(sss.sizes)}")

    return sst, ssha, sss


def regrid_to_target(da, target_lat, target_lon, lat_name="latitude", lon_name="longitude"):
    rename_map = {}
    if lat_name in da.dims and lat_name != "lat":
        rename_map[lat_name] = "lat"
    if lon_name in da.dims and lon_name != "lon":
        rename_map[lon_name] = "lon"
    if rename_map:
        da = da.rename(rename_map)

    da_regridded = da.interp(lat=target_lat, lon=target_lon, method="linear")
    return da_regridded


def build_common_grid_stack(out_path="data/interim/common_grid_stack.nc"):
    print("Loading raw data...")
    sst, ssha, sss = load_all_raw()

    target_lat = sst.lat
    target_lon = sst.lon

    print("\nRegridding SSHa onto SST's 0.25 deg grid...")
    ssha_regridded = regrid_to_target(ssha, target_lat, target_lon)

    print("Regridding SSS onto SST's 0.25 deg grid...")
    sss_regridded = regrid_to_target(sss, target_lat, target_lon)

    print("\nCombining into single dataset...")
    combined = xr.Dataset({
        "sst": sst,
        "ssha": ssha_regridded,
        "sss": sss_regridded,
    })

    print(f"\nCombined grid stack: {dict(combined.sizes)}")
    print(f"Variables: {list(combined.data_vars)}")

    for var in combined.data_vars:
        nan_frac = float(combined[var].isnull().mean())
        print(f"  {var}: {nan_frac*100:.2f}% NaN after regridding")

    out_file = Path(out_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"\nSaving to {out_file} ...")
    combined.to_netcdf(out_file)
    print(f"Saved combined grid stack to {out_file}")

    return combined


if __name__ == "__main__":
    print("Starting regrid pipeline...")
    build_common_grid_stack()
    print("Done.")