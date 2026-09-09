import numpy as np
import pandas as pd
import torch
import matplotlib.pyplot as plt
from pathlib import Path

from src.models.baseline_regression import BaselineMLP

FEATURE_COLS = ["sst_matched", "ssha_matched", "sss_matched", "pressure"]

def predict_profile(model, mean, std, feature_values, pressures, device="cpu"):
    """
    feature_values: dict of {feature_name: scalar_value} for all features except pressure
    """
    n = len(pressures)
    cols = []
    for col in FEATURE_COLS[:-1]:  # all except pressure
        cols.append(np.full(n, feature_values[col], dtype=np.float32))
    cols.append(pressures.astype(np.float32))

    X = np.column_stack(cols)
    X_norm = (X - mean) / std
    X_t = torch.tensor(X_norm, dtype=torch.float32).to(device)

    with torch.no_grad():
        preds = model(X_t).cpu().numpy()

    return preds


def plot_float_profile(test_df, float_id, model, mean, std, out_dir="outputs/figures"):
    float_data = test_df[test_df["float_id"] == float_id].sort_values("pressure")

    if float_data.empty:
        print(f"No data found for float {float_id}")
        return

    feature_values = {col: float_data[col].iloc[0] for col in FEATURE_COLS[:-1]}
    pressures = float_data["pressure"].values
    actual_temps = float_data["temperature"].values

    predicted_temps = predict_profile(model, mean, std, feature_values, pressures)

    fig, ax = plt.subplots(figsize=(6, 8))
    ax.plot(actual_temps, pressures, "o-", label="Actual (Argo measured)", color="black", markersize=4)
    ax.plot(predicted_temps, pressures, "s--", label="Predicted (OceanEmbed MVP)", color="crimson", markersize=4)

    ax.invert_yaxis()
    ax.set_xlabel("Temperature (°C)")
    ax.set_ylabel("Pressure (dbar) ≈ Depth (m)")
    ax.set_title(f"Predicted vs. Actual Temperature Profile\nFloat {float_id}")
    ax.legend()
    ax.grid(alpha=0.3)

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    fig_path = out_path / f"profile_{float_id}.png"
    plt.savefig(fig_path, dpi=150, bbox_inches="tight")
    print(f"Saved plot to {fig_path}")
    plt.close(fig)


def compute_rmse_by_depth_band(test_df, model, mean, std):
    df = test_df.dropna(subset=FEATURE_COLS + ["temperature"]).copy()

    X = df[FEATURE_COLS].values.astype(np.float32)
    X_norm = (X - mean) / std
    X_t = torch.tensor(X_norm, dtype=torch.float32)

    with torch.no_grad():
        preds = model(X_t).numpy()

    df["predicted"] = preds
    df["error"] = df["predicted"] - df["temperature"]

    bands = [(0, 50, "Shallow (0-50m)"), (50, 200, "Thermocline (50-200m)"), (200, 1000, "Mid (200-1000m)"), (1000, 2100, "Deep (1000m+)")]

    print("\n--- RMSE by depth band ---")
    for low, high, label in bands:
        band_df = df[(df["pressure"] >= low) & (df["pressure"] < high)]
        if len(band_df) > 0:
            rmse = np.sqrt((band_df["error"] ** 2).mean())
            print(f"{label:25s}: RMSE = {rmse:.3f} degC  (n={len(band_df)})")
        else:
            print(f"{label:25s}: no data")

def load_model(checkpoint_path="checkpoints/baseline_mlp.pt", device="cpu"):
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model = BaselineMLP()
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model, checkpoint["mean"], checkpoint["std"]


if __name__ == "__main__":
    test_df = pd.read_csv("data/processed/test_df.csv")
    model, mean, std = load_model()

    compute_rmse_by_depth_band(test_df, model, mean, std)

    example_floats = test_df["float_id"].unique()[:3]
    for float_id in example_floats:
        plot_float_profile(test_df, float_id, model, mean, std)