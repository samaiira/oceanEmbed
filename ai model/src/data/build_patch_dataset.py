
"""
Phase 5 dataset prep: pair each temporal-stack patch with every depth-level
Argo measurement from that same profile, carrying positional features
(lat, lon, day_of_year) through for the decoder.
"""

import pandas as pd
import numpy as np
from pathlib import Path


def load_cleaned_argo(path="data/interim/argo_cleaned.csv"):
    df = pd.read_csv(path, parse_dates=["date"])
    df["date_only"] = df["date"].dt.floor("D") 
    if df["date_only"].dt.tz is not None:
        df["date_only"] = df["date_only"].dt.tz_localize(None)
    return df


def load_patches(patch_dir="data/processed/patches"):
    patch_dir = Path(patch_dir)
    patches = np.load(patch_dir / "patches.npy")
    metadata = pd.read_csv(patch_dir / "patches_metadata.csv", parse_dates=["date"])
    print(f"Loaded {patches.shape[0]} patches, shape {patches.shape}")
    return patches, metadata

def build_index(argo_df, metadata):
    metadata = metadata.reset_index().rename(columns={"index": "patch_idx"})
    metadata["date"] = pd.to_datetime(metadata["date"]).dt.floor("D")

    lookup = metadata.set_index(["float_id", "date"])["patch_idx"].to_dict()

    records = []
    unmatched = 0

    for _, row in argo_df.iterrows():
        key = (row["float_id"], row["date_only"])
        if key in lookup:
            records.append({
                "patch_idx": lookup[key],
                "pressure": row["pressure"],
                "temperature": row["temperature"],
                "float_id": row["float_id"],
            })
        else:
            unmatched += 1

    print(f"Matched {len(records)} depth-level rows to patches")
    print(f"Unmatched (patch was skipped/edge case): {unmatched}")

    return pd.DataFrame(records)


def split_by_float(index_df, test_frac=0.2, seed=42):
    unique_floats = index_df["float_id"].unique()
    rng = np.random.default_rng(seed)
    rng.shuffle(unique_floats)

    n_test = int(len(unique_floats) * test_frac)
    test_floats = set(unique_floats[:n_test])
    train_floats = set(unique_floats[n_test:])

    train_df = index_df[index_df["float_id"].isin(train_floats)].copy()
    test_df = index_df[index_df["float_id"].isin(test_floats)].copy()

    print(f"Train: {len(train_df)} rows, {len(train_floats)} floats")
    print(f"Test:  {len(test_df)} rows, {len(test_floats)} floats")

    return train_df, test_df


def build_patch_training_dataset(
    argo_path="data/interim/argo_cleaned.csv",
    patch_dir="data/processed/patches",
    out_dir="data/processed/patch_dataset"
):
    argo_df = load_cleaned_argo(argo_path)
    patches, metadata = load_patches(patch_dir)

    index_df = build_index(argo_df, metadata)
    train_df, test_df = split_by_float(index_df)

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    np.save(out_path / "patches.npy", patches)

    train_df.to_csv(out_path / "train_index.csv", index=False)
    test_df.to_csv(out_path / "test_index.csv", index=False)

    print(f"\nSaved patch dataset to {out_path}/")

    return patches, train_df, test_df


if __name__ == "__main__":
    build_patch_training_dataset()
