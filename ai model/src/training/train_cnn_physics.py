# """
# Phase 6 (CNN version): train the CNN encoder + MLP decoder with
# smoothness + monotonicity physics losses, batched by patch/profile
# so the penalties can compare predictions across depths of the SAME
# location/day.
# """

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from pathlib import Path
import copy

from src.models.oceanembed_model import OceanEmbedModel
from src.losses.physical_losses import combined_physics_loss


def load_data(data_dir="data/processed/patch_dataset"):
    data_dir = Path(data_dir)
    patches = np.load(data_dir / "patches.npy")
    train_df = pd.read_csv(data_dir / "train_index.csv")
    test_df = pd.read_csv(data_dir / "test_index.csv")
    return patches, train_df, test_df


def group_by_patch(df):
    """
    Groups rows by patch_idx (one group = all depth measurements from
    the SAME patch/profile), sorted shallow -> deep.
    """
    groups = []
    for patch_idx, g in df.groupby("patch_idx"):
        g_sorted = g.sort_values("pressure")
        pressures = g_sorted["pressure"].values.astype(np.float32)
        temps = g_sorted["temperature"].values.astype(np.float32)
        groups.append((int(patch_idx), pressures, temps))
    return groups


def train_model(epochs=60, lr=1e-3, patience=10,
                 lambda_smooth=0.05, lambda_mono=0.05, device=None):
    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    patches, train_df, test_df = load_data()
    print(f"Train: {len(train_df)} rows, {train_df['patch_idx'].nunique()} profiles")
    print(f"Test:  {len(test_df)} rows, {test_df['patch_idx'].nunique()} profiles")

    pressure_mean = train_df["pressure"].mean()
    pressure_std = train_df["pressure"].std()

    train_groups = group_by_patch(train_df)
    test_groups = group_by_patch(test_df)

    model = OceanEmbedModel(in_channels=patches.shape[1]).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=4)
    mse_fn = nn.MSELoss()

    best_test_rmse = float("inf")
    best_state = None
    epochs_without_improvement = 0

    for epoch in range(1, epochs + 1):
        model.train()
        rng = np.random.default_rng(epoch)
        order = rng.permutation(len(train_groups))

        total_mse, total_smooth, total_mono, n = 0.0, 0.0, 0.0, 0

        for idx in order:
            patch_idx, pressures, temps = train_groups[idx]
            patch_tensor = torch.tensor(patches[patch_idx], dtype=torch.float32, device=device).unsqueeze(0)
            patch_tensor = patch_tensor.repeat(len(pressures), 1, 1, 1)  # same patch for every depth

            pressure_norm = (pressures - pressure_mean) / pressure_std
            pressure_t = torch.tensor(pressure_norm, dtype=torch.float32, device=device).unsqueeze(1)
            temp_t = torch.tensor(temps, dtype=torch.float32, device=device)

            optimizer.zero_grad()
            preds = model(patch_tensor, pressure_t)  # already sorted shallow->deep
            loss, mse, smooth, mono = combined_physics_loss(
                preds, temp_t, mse_fn, lambda_smooth=lambda_smooth, lambda_mono=lambda_mono
            )
            loss.backward()
            optimizer.step()

            total_mse += mse.item()
            total_smooth += smooth.item()
            total_mono += mono.item()
            n += 1

        train_mse = total_mse / n

        model.eval()
        test_sq_errors = []
        with torch.no_grad():
            for patch_idx, pressures, temps in test_groups:
                patch_tensor = torch.tensor(patches[patch_idx], dtype=torch.float32, device=device).unsqueeze(0)
                patch_tensor = patch_tensor.repeat(len(pressures), 1, 1, 1)
                pressure_norm = (pressures - pressure_mean) / pressure_std
                pressure_t = torch.tensor(pressure_norm, dtype=torch.float32, device=device).unsqueeze(1)
                temp_t = torch.tensor(temps, dtype=torch.float32, device=device)

                preds = model(patch_tensor, pressure_t)
                test_sq_errors.append(((preds - temp_t) ** 2).cpu().numpy())

        test_mse = np.concatenate(test_sq_errors).mean()
        test_rmse = test_mse ** 0.5

        scheduler.step(test_mse)

        improved = test_rmse < best_test_rmse
        marker = " <-- best" if improved else ""
        print(f"Epoch {epoch:3d}/{epochs} | Train MSE: {train_mse:.4f} (smooth {total_smooth/n:.4f}, mono {total_mono/n:.4f}) | Test RMSE: {test_rmse:.3f} degC{marker}")

        if improved:
            best_test_rmse = test_rmse
            best_state = copy.deepcopy(model.state_dict())
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= patience:
                print(f"\nEarly stopping at epoch {epoch} (no improvement for {patience} epochs)")
                break

    model.load_state_dict(best_state)
    print(f"\nBest Test RMSE: {best_test_rmse:.3f} degC (restored best checkpoint)")

    out_dir = Path("checkpoints")
    out_dir.mkdir(parents=True, exist_ok=True)
    torch.save({
        "model_state": model.state_dict(),
        "pressure_mean": pressure_mean,
        "pressure_std": pressure_std,
        "in_channels": patches.shape[1],
        "best_test_rmse": best_test_rmse,
    }, out_dir / "cnn_physics_model.pt")
    print(f"Saved checkpoint to {out_dir / 'cnn_physics_model.pt'}")

    return model


if __name__ == "__main__":
    train_model(epochs=60, patience=12, lambda_smooth=0.005, lambda_mono=0.005)