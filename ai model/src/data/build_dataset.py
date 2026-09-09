"""
Build final training-ready arrays from the matched Argo+SST+SSHa+SSS dataset.
Input features (X): SST, SSHa, SSS, pressure
Target (y): Argo-measured temperature
"""

import pandas as pd
import numpy as np
from pathlib import Path


def load_matched_data(path="data/interim/argo_sst_ssha_sss_matched.csv"):
    df = pd.read_csv(path)
    print(f"Loaded matched data: {df.shape[0]} rows, {df['float_id'].nunique()} floats")
    return df


def split_by_float(df, test_frac=0.2, seed=42):
    unique_floats = df["float_id"].unique()
    rng = np.random.default_rng(seed)
    rng.shuffle(unique_floats)

    n_test = int(len(unique_floats) * test_frac)
    test_floats = set(unique_floats[:n_test])
    train_floats = set(unique_floats[n_test:])

    train_df = df[df["float_id"].isin(train_floats)].copy()
    test_df = df[df["float_id"].isin(test_floats)].copy()

    print(f"Train: {len(train_df)} rows, {len(train_floats)} floats")
    print(f"Test:  {len(test_df)} rows, {len(test_floats)} floats")

    return train_df, test_df


FEATURE_COLS = ["sst_matched", "ssha_matched", "sss_matched", "pressure"]


def build_arrays(df):
    df = df.dropna(subset=FEATURE_COLS + ["temperature"])
    X = df[FEATURE_COLS].values.astype(np.float32)
    y = df["temperature"].values.astype(np.float32)
    return X, y


def build_dataset(
    matched_path="data/interim/argo_sst_ssha_sss_matched.csv",
    out_dir="data/processed"
):
    df = load_matched_data(matched_path)
    train_df, test_df = split_by_float(df)

    X_train, y_train = build_arrays(train_df)
    X_test, y_test = build_arrays(test_df)

    print(f"\nX_train: {X_train.shape}, y_train: {y_train.shape}")
    print(f"X_test:  {X_test.shape}, y_test:  {y_test.shape}")

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    np.save(out_path / "X_train.npy", X_train)
    np.save(out_path / "y_train.npy", y_train)
    np.save(out_path / "X_test.npy", X_test)
    np.save(out_path / "y_test.npy", y_test)

    test_df.to_csv(out_path / "test_df.csv", index=False)

    print(f"\nSaved processed arrays to {out_path}/")

    return X_train, y_train, X_test, y_test


if __name__ == "__main__":
    build_dataset()