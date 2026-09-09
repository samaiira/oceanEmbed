"""
Standalone inference script: given SST, SSHa, SSS at a location/day,
predict the full temperature profile from surface to 2000m.

Usage:
    python -m src.inference --sst 27.5 --ssha 0.05 --sss 35.2
"""

import argparse
import numpy as np
import torch
import matplotlib.pyplot as plt
from pathlib import Path

from src.models.baseline_regression import BaselineMLP


def load_model(checkpoint_path="checkpoints/baseline_mlp.pt", device="cpu"):
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model = BaselineMLP()
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model, checkpoint["mean"], checkpoint["std"]


def predict_full_profile(model, mean, std, sst, ssha, sss, depths=None, device="cpu"):
    if depths is None:
        # Standard depth levels, surface to 2000m
        depths = np.array([0, 10, 20, 30, 50, 75, 100, 125, 150, 200, 250, 300,
                            400, 500, 600, 700, 800, 1000, 1200, 1500, 1750, 2000], dtype=np.float32)

    n = len(depths)
    X = np.column_stack([
        np.full(n, sst, dtype=np.float32),
        np.full(n, ssha, dtype=np.float32),
        np.full(n, sss, dtype=np.float32),
        depths,
    ])
    X_norm = (X - mean) / std
    X_t = torch.tensor(X_norm, dtype=torch.float32).to(device)

    with torch.no_grad():
        preds = model(X_t).cpu().numpy()

    return depths, preds


def plot_and_save(depths, preds, sst, ssha, sss, out_path="outputs/figures/inference_profile.png"):
    fig, ax = plt.subplots(figsize=(6, 8))
    ax.plot(preds, depths, "s--", color="crimson", markersize=5, label="OceanEmbed prediction")
    ax.invert_yaxis()
    ax.set_xlabel("Predicted Temperature (°C)")
    ax.set_ylabel("Depth (m)")
    ax.set_title(f"OceanEmbed Predicted Profile\nSST={sst}°C, SSHa={ssha}m, SSS={sss}psu")
    ax.legend()
    ax.grid(alpha=0.3)

    out_file = Path(out_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_file, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved plot to {out_file}")


def main():
    parser = argparse.ArgumentParser(description="OceanEmbed inference: predict subsurface temperature profile")
    parser.add_argument("--sst", type=float, required=True, help="Sea surface temperature (°C)")
    parser.add_argument("--ssha", type=float, required=True, help="Sea surface height anomaly (m)")
    parser.add_argument("--sss", type=float, required=True, help="Sea surface salinity (psu)")
    args = parser.parse_args()

    model, mean, std = load_model()
    depths, preds = predict_full_profile(model, mean, std, args.sst, args.ssha, args.sss)

    print("\nPredicted Temperature Profile:")
    print(f"{'Depth (m)':>12} | {'Temp (°C)':>10}")
    print("-" * 27)
    for d, t in zip(depths, preds):
        print(f"{d:>12.0f} | {t:>10.2f}")

    plot_and_save(depths, preds, args.sst, args.ssha, args.sss)


if __name__ == "__main__":
    main()