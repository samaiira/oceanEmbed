"""
Match each cleaned Argo profile to its nearest SST, SSHa, SSS, and currents grid cell/day.
"""

import pandas as pd
import xarray as xr
import numpy as np
from pathlib import Path


def load_cleaned_argo(path="data/interim/argo_cleaned.csv"):
    df = pd.read_csv(path, parse_dates=["date"])
    print(f"Loaded cleaned Argo: {df.shape[0]} rows, {df['float_id'].nunique()} floats")
    return df


def load_sst(path="data/raw/sst/sst_2023-01-01_2023-02-01.nc"):
    ds = xr.open_dataset(path)
    ds = ds.sst.squeeze("zlev", drop=True)
    print(f"Loaded SST grid: {ds.dims}")
    return ds


def load_ssha(path="data/raw/ssha/ssha_2023-01-01_2023-02-01.nc"):
    ds = xr.open_dataset(path)
    da = ds.sla
    print(f"Loaded SSHa grid: {da.dims}")
    return da


def load_sss(path="data/raw/sss/sss_2023-01-01_2023-02-01.nc"):
    ds = xr.open_dataset(path)
    da = ds.sos.squeeze("depth", drop=True)
    print(f"Loaded SSS grid: {da.dims}")
    return da


def load_currents(path="data/raw/currents/currents_2023-01-01_2023-02-01.nc"):
    ds = xr.open_dataset(path)
    # Select surface layer only (depth=0), drop the 15m layer
    u = ds.uo.sel(depth=0, method="nearest").drop_vars("depth")
    v = ds.vo.sel(depth=0, method="nearest").drop_vars("depth")
    print(f"Loaded currents grid: {u.dims}")
    return u, v


def match_argo_to_grids(argo_df, sst_da, ssha_da, sss_da, u_da, v_da):
    argo_df = argo_df.copy()
    argo_df["date_only"] = argo_df["date"].dt.floor("D")

    if argo_df["date_only"].dt.tz is not None:
        argo_df["date_only"] = argo_df["date_only"].dt.tz_localize(None)

    matched_rows = []
    skipped = 0

    for date_val, group in argo_df.groupby("date_only"):
        try:
            sst_day = sst_da.sel(time=date_val, method="nearest")
            ssha_day = ssha_da.sel(time=date_val, method="nearest")
            sss_day = sss_da.sel(time=date_val, method="nearest")
            u_day = u_da.sel(time=date_val, method="nearest")
            v_day = v_da.sel(time=date_val, method="nearest")
        except Exception as e:
            print(f"  Failed to match {date_val}: {e}")
            skipped += len(group)
            continue

        lat_da = xr.DataArray(group["lat"].values, dims="points")
        lon_da = xr.DataArray(group["lon"].values, dims="points")

        sst_values = sst_day.sel(lat=lat_da, lon=lon_da, method="nearest").values
        ssha_values = ssha_day.sel(latitude=lat_da, longitude=lon_da, method="nearest").values
        sss_values = sss_day.sel(latitude=lat_da, longitude=lon_da, method="nearest").values
        u_values = u_day.sel(latitude=lat_da, longitude=lon_da, method="nearest").values
        v_values = v_day.sel(latitude=lat_da, longitude=lon_da, method="nearest").values

        group = group.copy()
        group["sst_matched"] = sst_values
        group["ssha_matched"] = ssha_values
        group["sss_matched"] = sss_values
        group["u_curr_matched"] = u_values
        group["v_curr_matched"] = v_values
        matched_rows.append(group)

    if skipped > 0:
        print(f"WARNING: skipped {skipped} rows — no matching grid day found")

    if not matched_rows:
        raise RuntimeError("No rows matched at all — check date/timezone alignment")

    result = pd.concat(matched_rows, ignore_index=True)
    return result


def summarize_match(df):
    print(f"\nMatched rows: {len(df)}")
    for col in ["sst_matched", "ssha_matched", "sss_matched", "u_curr_matched", "v_curr_matched"]:
        print(f"NaN {col}: {df[col].isna().sum()}")
    print(df[["float_id", "date", "lat", "lon", "pressure", "temperature",
               "sst_matched", "ssha_matched", "sss_matched", "u_curr_matched", "v_curr_matched"]].head(10))


def run_matching(
    argo_path="data/interim/argo_cleaned.csv",
    sst_path="data/raw/sst/sst_2023-01-01_2023-02-01.nc",
    ssha_path="data/raw/ssha/ssha_2023-01-01_2023-02-01.nc",
    sss_path="data/raw/sss/sss_2023-01-01_2023-02-01.nc",
    currents_path="data/raw/currents/currents_2023-01-01_2023-02-01.nc",
    out_path="data/interim/argo_full_matched.csv"
):
    argo_df = load_cleaned_argo(argo_path)
    sst_da = load_sst(sst_path)
    ssha_da = load_ssha(ssha_path)
    sss_da = load_sss(sss_path)
    u_da, v_da = load_currents(currents_path)

    matched = match_argo_to_grids(argo_df, sst_da, ssha_da, sss_da, u_da, v_da)
    summarize_match(matched)

    out_file = Path(out_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    matched.to_csv(out_file, index=False)
    print(f"\nSaved matched dataset to {out_file}")

    return matched


if __name__ == "__main__":
    run_matching()