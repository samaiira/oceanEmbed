"""
Phase 5: train the CNN encoder + positional features + MLP decoder model.
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from pathlib import Path

from src.models.oceanembed_temporal_model import OceanEmbedTemporalModel


class TemporalPatchDataset(Dataset):
    def __init__(self, patches, index_df, stats=None):
        self.patches = patches
        self.index_df = index_df.reset_index(drop=True)

        if stats is None:
            stats = {
                "pressure_mean": index_df["pressure"].mean(),
                "pressure_std": index_df["pressure"].std(),
                "lat_mean": index_df["lat"].mean(),
                "lat_std": index_df["lat"].std(),
                "lon_mean": index_df["lon"].mean(),
                "lon_std": index_df["lon"].std(),
            }
        self.stats = stats

    def __len__(self):
        return len(self.index_df)

    def __getitem__(self, idx):
        row = self.index_df.iloc[idx]
        patch = self.patches[int(row["patch_idx"])]

        pressure = (row["pressure"] - self.stats["pressure_mean"]) / self.stats["pressure_std"]

        lat_norm = (row["lat"] - self.stats["lat_mean"]) / self.stats["lat_std"]
        lon_norm = (row["lon"] - self.stats["lon_mean"]) / self.stats["lon_std"]
        doy = row["day_of_year"]
        doy_sin = np.sin(2 * np.pi * doy / 365.0)
        doy_cos = np.cos(2 * np.pi * doy / 365.0)

        pos_features = np.array([lat_norm, lon_norm, doy_sin, doy_cos], dtype=np.float32)
        temperature = row["temperature"]

        return (
            torch.tensor(patch, dtype=torch.float32),
            torch.tensor(pos_features, dtype=torch.float32),
            torch.tensor([pressure], dtype=torch.float32),
            torch.tensor(temperature, dtype=torch.float32),
        )


def load_data(data_dir="data/processed/patch_dataset_temporal"):
    data_dir = Path(data_dir)
    patches = np.load(data_dir / "patches.npy")
    train_df = pd.read_csv(data_dir / "train_index.csv")
    test_df = pd.read_csv(data_dir / "test_index.csv")
    return patches, train_df, test_df


def train_model(epochs=60, batch_size=64, lr=1e-3, patience=10, device=None):
    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    patches, train_df, test_df = load_data()

    train_ds = TemporalPatchDataset(patches, train_df)
    test_ds = TemporalPatchDataset(patches, test_df, stats=train_ds.stats)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_ds, batch_size=256, shuffle=False)

    model = OceanEmbedTemporalModel(in_channels=patches.shape[1]).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=4)
    loss_fn = nn.MSELoss()

    import copy
    best_test_loss = float("inf")
    best_state = None
    epochs_without_improvement = 0

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0

        for patch, pos, pressure, temp in train_loader:
            patch, pos, pressure, temp = patch.to(device), pos.to(device), pressure.to(device), temp.to(device)
            optimizer.zero_grad()
            preds = model(patch, pos, pressure)
            loss = loss_fn(preds, temp)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(temp)

        train_loss = total_loss / len(train_ds)

        model.eval()
        test_loss_total = 0.0
        with torch.no_grad():
            for patch, pos, pressure, temp in test_loader:
                patch, pos, pressure, temp = patch.to(device), pos.to(device), pressure.to(device), temp.to(device)
                preds = model(patch, pos, pressure)
                loss = loss_fn(preds, temp)
                test_loss_total += loss.item() * len(temp)

        test_loss = test_loss_total / len(test_ds)
        test_rmse = test_loss ** 0.5

        scheduler.step(test_loss)

        improved = test_loss < best_test_loss
        marker = " <-- best" if improved else ""
        print(f"Epoch {epoch:3d}/{epochs} | Train MSE: {train_loss:.4f} | Test MSE: {test_loss:.4f} | Test RMSE: {test_rmse:.3f} degC{marker}")

        if improved:
            best_test_loss = test_loss
            best_state = copy.deepcopy(model.state_dict())
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= patience:
                print(f"\nEarly stopping at epoch {epoch} (no improvement for {patience} epochs)")
                break

    model.load_state_dict(best_state)
    best_rmse = best_test_loss ** 0.5
    print(f"\nBest Test RMSE: {best_rmse:.3f} degC (restored best checkpoint)")

    out_dir = Path("checkpoints")
    out_dir.mkdir(parents=True, exist_ok=True)
    torch.save({
        "model_state": model.state_dict(),
        "stats": train_ds.stats,
        "in_channels": patches.shape[1],
        "best_test_rmse": best_rmse,
    }, out_dir / "cnn_temporal_model.pt")
    print(f"\nSaved model checkpoint to {out_dir / 'cnn_temporal_model.pt'}")

    return model


if __name__ == "__main__":
    train_model()