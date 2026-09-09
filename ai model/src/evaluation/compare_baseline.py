"""
Phase 8: Compare the trained MLP against a simple linear regression baseline
on the same inputs (SST, SSHa, SSS, pressure -> temperature).

This proves whether the neural network's added complexity is actually earning
its keep, or whether a much simpler model does just as well.
"""

import numpy as np
import pandas as pd
import torch
from pathlib import Path
from sklearn.linear_model import LinearRegression

from src.models.baseline_regression import BaselineMLP


FEATURE_COLS = ["sst_matched", "ssha_matched", "sss_matched", "pressure"]


def load_data(data_dir="data/processed"):
    data_dir = Path(data_dir)
    X_train = np.load(data_dir / "X_train.npy")
    y_train = np.load(data_dir / "y_train.npy")
    X_test = np.load(data_dir / "X_test.npy")
    y_test = np.load(data_dir / "y_test.npy")
    test_df = pd.read_csv(data_dir / "test_df.csv")
    return X_train, y_train, X_test, y_test, test_df


def train_linear_baseline(X_train, y_train):
    model = LinearRegression()
    model.fit(X_train, y_train)
    return model


def load_mlp(checkpoint_path="checkpoints/baseline_mlp.pt", device="cpu"):
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model = BaselineMLP()
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model, checkpoint["mean"], checkpoint["std"]


def predict_mlp(model, mean, std, X, device="cpu"):
    X_norm = (X - mean) / std
    X_t = torch.tensor(X_norm, dtype=torch.float32).to(device)
    with torch.no_grad():
        preds = model(X_t).cpu().numpy()
    return preds


def rmse_by_depth_band(y_true, y_pred, pressure, label):
    bands = [(0, 50, "Shallow (0-50m)"), (50, 200, "Thermocline (50-200m)"),
              (200, 1000, "Mid (200-1000m)"), (1000, 2100, "Deep (1000m+)")]

    print(f"\n--- {label}: RMSE by depth band ---")
    results = {}
    for low, high, band_label in bands:
        mask = (pressure >= low) & (pressure < high)
        if mask.sum() > 0:
            rmse = np.sqrt(np.mean((y_pred[mask] - y_true[mask]) ** 2))
            results[band_label] = rmse
            print(f"{band_label:25s}: RMSE = {rmse:.3f} degC  (n={mask.sum()})")
        else:
            results[band_label] = None
            print(f"{band_label:25s}: no data")

    overall_rmse = np.sqrt(np.mean((y_pred - y_true) ** 2))
    print(f"{'Overall':25s}: RMSE = {overall_rmse:.3f} degC")
    results["Overall"] = overall_rmse
    return results


def run_comparison():
    X_train, y_train, X_test, y_test, test_df = load_data()
    pressure = X_test[:, -1]  # pressure is the last column

    # Linear baseline
    linear_model = train_linear_baseline(X_train, y_train)
    linear_preds = linear_model.predict(X_test)
    linear_results = rmse_by_depth_band(y_test, linear_preds, pressure, "Linear Regression Baseline")

    # MLP
    mlp_model, mean, std = load_mlp()
    mlp_preds = predict_mlp(mlp_model, mean, std, X_test)
    mlp_results = rmse_by_depth_band(y_test, mlp_preds, pressure, "MLP (OceanEmbed)")

    # Side-by-side comparison table
    print("\n\n=== COMPARISON: Linear vs. MLP ===")
    print(f"{'Depth Band':25s} | {'Linear RMSE':>12s} | {'MLP RMSE':>12s} | {'MLP Better?':>12s}")
    print("-" * 70)
    for band in linear_results:
        lin_val = linear_results[band]
        mlp_val = mlp_results[band]
        better = "YES" if mlp_val < lin_val else "NO"
        print(f"{band:25s} | {lin_val:>10.3f}°C | {mlp_val:>10.3f}°C | {better:>12s}")

    return linear_results, mlp_results


if __name__ == "__main__":
    run_comparison()