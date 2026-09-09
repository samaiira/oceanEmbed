"""
Clean and quality-control the raw Argo dataset before it's used for training.

Steps:
1. Drop rows with missing temperature/salinity/pressure
2. Drop duplicate measurements (same float, date, pressure)
3. Filter out physically implausible values (sanity bounds)
4. Report summary stats before/after cleaning
5. Save cleaned dataset to data/interim/
"""

import pandas as pd
from pathlib import Path


def load_raw_argo(path):
    df = pd.read_csv(path)
    print(f"Loaded raw Argo data: {df.shape[0]} rows, {df['float_id'].nunique()} floats")
    return df


def drop_missing_values(df):
    before = len(df)
    df = df.dropna(subset=["temperature", "salinity", "pressure"])
    after = len(df)
    print(f"Dropped {before - after} rows with missing temp/salinity/pressure ({before} -> {after})")
    return df


def drop_duplicates(df):
    before = len(df)
    df = df.drop_duplicates(subset=["float_id", "date", "pressure"])
    after = len(df)
    print(f"Dropped {before - after} duplicate rows ({before} -> {after})")
    return df


def filter_physical_bounds(df):
    """
    Remove physically implausible values — a basic sanity filter.
    Ocean temperature: realistically -2 to 35 degC
    Salinity: realistically 2 to 41 psu (extreme low end allows for river-influenced coastal areas)
    Pressure: 0 to 2100 dbar (~2000m, covers our needs with margin)
    """
    before = len(df)
    df = df[
        (df["temperature"] >= -2) & (df["temperature"] <= 35) &
        (df["salinity"] >= 2) & (df["salinity"] <= 41) &
        (df["pressure"] >= 0) & (df["pressure"] <= 2100)
    ]
    after = len(df)
    print(f"Dropped {before - after} rows outside physical bounds ({before} -> {after})")
    return df


def summarize(df, label=""):
    print(f"\n--- Summary: {label} ---")
    print(f"Rows: {len(df)}")
    print(f"Unique floats: {df['float_id'].nunique()}")
    print(f"Date range: {df['date'].min()} to {df['date'].max()}")
    print(f"Lat range: {df['lat'].min():.2f} to {df['lat'].max():.2f}")
    print(f"Lon range: {df['lon'].min():.2f} to {df['lon'].max():.2f}")
    print(f"Pressure range: {df['pressure'].min():.1f} to {df['pressure'].max():.1f} dbar")
    print(f"Temperature range: {df['temperature'].min():.2f} to {df['temperature'].max():.2f} degC")
    print(f"Salinity range: {df['salinity'].min():.2f} to {df['salinity'].max():.2f} psu")


def clean_argo_dataset(raw_path, out_path="data/interim/argo_cleaned.csv"):
    df = load_raw_argo(raw_path)
    summarize(df, "raw")

    df = drop_missing_values(df)
    df = drop_duplicates(df)
    df = filter_physical_bounds(df)

    summarize(df, "cleaned")

    out_file = Path(out_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_file, index=False)
    print(f"\nSaved cleaned dataset to {out_file}")

    return df


if __name__ == "__main__":
    clean_argo_dataset(
        raw_path="data/raw/argo/argo_2023-01-01_2024-01-01.csv",
)