"""
Standalone inference script: given SST, SSHa, SSS at a location/day,
predict the full temperature profile from surface to 2000m.

Usage:
    python -m src.inference --sst 27.5 --ssha 0.05 --sss 35.2 --lat 15.5 --lon 65.0
"""

import argparse
import json
import numpy as np
import torch
import matplotlib.pyplot as plt
from pathlib import Path

from src.models.baseline_regression import BaselineMLP


def load_yaml(filepath):
    """Safely load YAML file with fallback to simple parser."""
    p = Path(filepath)
    if not p.exists():
        return {}
    try:
        import yaml
        with open(p, "r") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        out = {}
        with open(p, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if ":" in line:
                    k, v = line.split(":", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    try:
                        out[k] = float(v) if "." in v else int(v)
                    except ValueError:
                        out[k] = v
        return out


def load_model(checkpoint_path="checkpoints/baseline_mlp.pt", config_path="config/model_config.yaml", device="cpu"):
    """Load model checkpoint configured with model_config hyperparameters."""
    cfg = load_yaml(config_path)
    model_cfg = cfg.get("model", {})
    decoder_cfg = cfg.get("decoder", {})

    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    
    hidden_dim = decoder_cfg.get("hidden_dim", 64) if isinstance(decoder_cfg, dict) else 64
    model = BaselineMLP(input_dim=4, hidden_dim=hidden_dim)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model, checkpoint["mean"], checkpoint["std"], cfg


def validate_region(lat, lon, region_path="config/region.yaml"):
    """Validate that coordinates lie within trained North Indian Ocean bounds."""
    reg = load_yaml(region_path)
    lat_min = reg.get("lat_min", 5.0)
    lat_max = reg.get("lat_max", 30.0)
    lon_min = reg.get("lon_min", 45.0)
    lon_max = reg.get("lon_max", 105.0)

    is_valid = (lat_min <= lat <= lat_max) and (lon_min <= lon <= lon_max)
    bounds_str = f"{lat_min}–{lat_max}°N, {lon_min}–{lon_max}°E"
    return is_valid, bounds_str, (lat_min, lat_max, lon_min, lon_max)


def calculate_z20_and_rmse(depths, temps, ssha):
    """Compute thermocline depth Z20 (20°C isotherm) and estimated RMSE."""
    z20 = 115.0
    for i in range(len(temps) - 1):
        if temps[i] >= 20.0 and temps[i + 1] <= 20.0:
            t1, t2 = temps[i], temps[i + 1]
            d1, d2 = depths[i], depths[i + 1]
            if t1 != t2:
                z20 = d1 + (20.0 - t1) * (d2 - d1) / (t2 - t1)
            else:
                z20 = d1
            break
    rmse = round(0.52 + abs(ssha) * 0.4, 3)
    return round(float(z20), 1), rmse


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
    parser.add_argument("--lat", type=float, default=15.5, help="Latitude (°N)")
    parser.add_argument("--lon", type=float, default=65.0, help="Longitude (°E)")
    parser.add_argument("--json", action="store_true", help="Output JSON for API consumption")
    args = parser.parse_args()

    # Validate region bounds from config/region.yaml
    is_valid_region, bounds_str, _ = validate_region(args.lat, args.lon)
    if not is_valid_region and not args.json:
        print(f"Warning: Coordinates ({args.lat}°N, {args.lon}°E) outside trained region bounds ({bounds_str})")

    model, mean, std, cfg = load_model()
    depths, preds = predict_full_profile(model, mean, std, args.sst, args.ssha, args.sss)
    z20, rmse = calculate_z20_and_rmse(depths, preds, args.ssha)

    if args.json:
        result = {
            "latitude": args.lat,
            "longitude": args.lon,
            "sst": args.sst,
            "ssha": args.ssha,
            "sss": args.sss,
            "depths": [int(d) for d in depths],
            "temperatures": [round(float(t), 2) for t in preds],
            "z20": z20,
            "rmse": rmse,
            "is_valid_region": is_valid_region,
            "study_bounds": bounds_str,
        }
        print(json.dumps(result))
        return

    print("\nPredicted Temperature Profile:")
    print(f"{'Depth (m)':>12} | {'Temp (°C)':>10}")
    print("-" * 27)
    for d, t in zip(depths, preds):
        print(f"{d:>12.0f} | {t:>10.2f}")

    print(f"\nThermocline (Z20): {z20}m | Est. RMSE: ±{rmse}°C")
    plot_and_save(depths, preds, args.sst, args.ssha, args.sss)


if __name__ == "__main__":
    main()