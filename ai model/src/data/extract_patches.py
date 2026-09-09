"""
Phase 2 (final step) -> Phase 4 prerequisite: extract spatial patches
around each Argo float location from the common gridded stack.

Land/NaN cells are filled with 0 and flagged via an explicit land-mask
channel, rather than dropping profiles near the coast entirely.
"""

import xarray as xr
import numpy as np
import pandas as pd
from pathlib import Path


PATCH_SIZE = 15


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
        return None  # only skip if truly out of the domain (rare)

    patch = grid_day.isel(lat=slice(lat_start, lat_end), lon=slice(lon_start, lon_end))
    return patch


def build_patch_dataset(
    argo_path="data/interim/argo_cleaned.csv",
    grid_path="data/interim/common_grid_stack.nc",
    out_dir="data/processed/patches"
):
    argo_df = load_cleaned_argo(argo_path)
    grid = xr.open_dataset(grid_path)

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    unique_profiles = argo_df.drop_duplicates(subset=["float_id", "date_only"])[
        ["float_id", "date_only", "lat", "lon"]
    ].reset_index(drop=True)

    print(f"Extracting patches for {len(unique_profiles)} unique profiles...")

    patches = []
    metadata = []
    skipped_edge = 0
    land_fraction_list = []

    for _, row in unique_profiles.iterrows():
        date_val = row["date_only"]
        try:
            grid_day = grid.sel(time=date_val, method="nearest")
        except Exception:
            continue

        patch = get_patch(grid_day, row["lat"], row["lon"])
        if patch is None:
            skipped_edge += 1
            continue

        raw_vars = [patch.sst.values, patch.ssha.values, patch.sss.values]

        # Land mask: 1 = ocean (valid), 0 = land/NaN -- computed from any one variable, they share the same mask
        land_mask = (~np.isnan(raw_vars[0])).astype(np.float32)
        land_fraction = 1.0 - land_mask.mean()
        land_fraction_list.append(land_fraction)

        # Fill NaN (land) cells with 0 in each variable
        filled_vars = [np.nan_to_num(v, nan=0.0) for v in raw_vars]

        # Stack: 5 data channels + 1 land-mask channel = 6 channels total
        patch_array = np.stack(filled_vars + [land_mask])

        patches.append(patch_array)
        metadata.append({
            "float_id": row["float_id"], "date": date_val,
            "lat": row["lat"], "lon": row["lon"],
            "land_fraction": land_fraction
        })

    print(f"Successfully extracted: {len(patches)}")
    print(f"Skipped (too close to domain edge): {skipped_edge}")
    print(f"Average land fraction in patches: {np.mean(land_fraction_list)*100:.1f}%")
    print(f"Patches with >50% land: {sum(f > 0.5 for f in land_fraction_list)}")

    patches_array = np.stack(patches).astype(np.float32)  # (N, 6, patch_size, patch_size)
    metadata_df = pd.DataFrame(metadata)

    np.save(out_path / "patches.npy", patches_array)
    metadata_df.to_csv(out_path / "patches_metadata.csv", index=False)

    print(f"\nSaved patches array: {patches_array.shape}  (channels: sst, ssha, sss, u_curr, v_curr, land_mask)")
    print(f"Saved metadata: {metadata_df.shape}")

    return patches_array, metadata_df


if __name__ == "__main__":
    build_patch_dataset()