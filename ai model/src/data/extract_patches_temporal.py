
"""
Phase 5: extract spatial patches WITH a temporal stack (last N days,
including the current day) instead of a single day's snapshot.

Profiles in the first (N-1) days of the dataset are skipped since there's
no prior history available for them yet.
"""

import xarray as xr
import numpy as np
import pandas as pd
from pathlib import Path


PATCH_SIZE = 15
TEMPORAL_WINDOW = 5  # current day + 4 prior days


def load_cleaned_argo(path="data/interim/argo_cleaned.csv"):
    df = pd.read_csv(path, parse_dates=["date"])
    df["date_only"] = df["date"].dt.floor("D")
    if df["date_only"].dt.tz is not None:
        df["date_only"] = df["date_only"].dt.tz_localize(None)
    return df


def get_patch(grid_day, lat_val, lon_val, patch_size=PATCH_SIZE):
    lat_idx = int(np.abs(grid_day.lat.values - lat_val).argmin())
    lon_idx = int(np.abs(grid_day.lon.values - lon_val).argmin())

    half = patch_size // 2
    lat_start, lat_end = lat_idx - half, lat_idx + half + 1
    lon_start, lon_end = lon_idx - half, lon_idx + half + 1

    if lat_start < 0 or lon_start < 0 or lat_end > grid_day.sizes["lat"] or lon_end > grid_day.sizes["lon"]:
        return None

    patch = grid_day.isel(lat=slice(lat_start, lat_end), lon=slice(lon_start, lon_end))
    return patch


def build_temporal_patch_dataset(
    argo_path="data/interim/argo_cleaned.csv",
    grid_path="data/interim/common_grid_stack.nc",
    out_dir="data/processed/patches_temporal",
    temporal_window=TEMPORAL_WINDOW
):
    argo_df = load_cleaned_argo(argo_path)
    grid = xr.open_dataset(grid_path)

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    all_dates = sorted(grid.time.values)
    min_available_date = pd.Timestamp(all_dates[temporal_window - 1])

    unique_profiles = argo_df.drop_duplicates(subset=["float_id", "date_only"])[
        ["float_id", "date_only", "lat", "lon"]
    ].reset_index(drop=True)

    print(f"Total unique profiles: {len(unique_profiles)}")

    unique_profiles = unique_profiles[unique_profiles["date_only"] >= min_available_date].reset_index(drop=True)
    print(f"Profiles with enough temporal history (>= {temporal_window} days in): {len(unique_profiles)}")

    patches = []
    metadata = []
    skipped_missing_day = 0

    for _, row in unique_profiles.iterrows():
        current_date = row["date_only"]
        window_dates = pd.date_range(end=current_date, periods=temporal_window, freq="D")

        day_patches = []
        valid = True

        for d in window_dates:
            try:
                grid_day = grid.sel(time=d, method="nearest")
                if abs((pd.Timestamp(grid_day.time.values) - d).total_seconds()) > 86400:
                    valid = False
                    break
            except Exception:
                valid = False
                break

            patch = get_patch(grid_day, row["lat"], row["lon"])
            if patch is None:
                valid = False
                break

            raw_vars = [patch.sst.values, patch.ssha.values, patch.sss.values,
                        patch.u_curr.values, patch.v_curr.values]
            land_mask = (~np.isnan(raw_vars[0])).astype(np.float32)
            filled_vars = [np.nan_to_num(v, nan=0.0) for v in raw_vars]

            day_patches.append(np.stack(filled_vars))

        if not valid:
            skipped_missing_day += 1
            continue

        temporal_stack = np.concatenate(day_patches, axis=0)
        full_patch = np.concatenate([temporal_stack, land_mask[np.newaxis, ...]], axis=0)

        patches.append(full_patch)

        day_of_year = current_date.dayofyear
        metadata.append({
            "float_id": row["float_id"], "date": current_date,
            "lat": row["lat"], "lon": row["lon"],
            "day_of_year": day_of_year,
        })

    print(f"Successfully extracted: {len(patches)}")
    print(f"Skipped (edge/missing day in window): {skipped_missing_day}")

    if len(patches) == 0:
        raise RuntimeError("No patches extracted - check temporal_window vs available date range")

    patches_array = np.stack(patches).astype(np.float32)
    metadata_df = pd.DataFrame(metadata)

    np.save(out_path / "patches.npy", patches_array)
    metadata_df.to_csv(out_path / "patches_metadata.csv", index=False)

    n_channels = temporal_window * 5 + 1
    print(f"\nSaved patches array: {patches_array.shape}  (expected channels: {temporal_window} days x 5 vars + 1 land mask = {n_channels})")
    print(f"Saved metadata: {metadata_df.shape}")

    return patches_array, metadata_df


if __name__ == "__main__":
    build_temporal_patch_dataset()
