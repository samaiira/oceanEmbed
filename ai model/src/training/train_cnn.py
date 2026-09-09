"""
Phase 4/5 training with dropout regularization, early stopping,
and a learning rate scheduler to reduce epoch-to-epoch fluctuation.
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from pathlib import Path
import copy

from src.models.oceanembed_model import OceanEmbedModel


class PatchDepthDataset(Dataset):
    def __init__(self, patches, index_df, pressure_mean=None, pressure_std=None):
        self.patches = patches
        self.index_df = index_df.reset_index(drop=True)
        if pressure_mean is None:
            pressure_mean = index_df["pressure"].mean()
            pressure_std = index_df["pressure"].std()
        self.pressure_mean = pressure_mean
        self.pressure_std = pressure_std

    def __len__(self):
        return len(self.index_df)

    def __getitem__(self, idx):
        row = self.index_df.iloc[idx]
        patch = self.patches[int(row["patch_idx"])]
        pressure = (row["pressure"] - self.pressure_mean) / self.pressure_std
        temperature = row["temperature"]
        return (
            torch.tensor(patch, dtype=torch.float32),
            torch.tensor([pressure], dtype=torch.float32),
            torch.tensor(temperature, dtype=torch.float32),
        )


def load_data(data_dir="data/processed/patch_dataset"):
    data_dir = Path(data_dir)
    patches = np.load(data_dir / "patches.npy")
    train_df = pd.read_csv(data_dir / "train_index.csv")
    test_df = pd.read_csv(data_dir / "test_index.csv")
    return patches, train_df, test_df


def train_model(epochs=60, batch_size=64, lr=5e-4, patience=12, device=None):
    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    patches, train_df, test_df = load_data()

    train_ds = PatchDepthDataset(patches, train_df)
    test_ds = PatchDepthDataset(
        patches, test_df,
        pressure_mean=train_ds.pressure_mean, pressure_std=train_ds.pressure_std
    )

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_ds, batch_size=256, shuffle=False)

    model = OceanEmbedModel(in_channels=patches.shape[1]).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=4)
    loss_fn = nn.MSELoss()

    best_test_loss = float("inf")
    best_state = None
    epochs_without_improvement = 0

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for patch, pressure, temp in train_loader:
            patch, pressure, temp = patch.to(device), pressure.to(device), temp.to(device)
            optimizer.zero_grad()
            preds = model(patch, pressure)
            loss = loss_fn(preds, temp)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(temp)
        train_loss = total_loss / len(train_ds)

        model.eval()
        test_loss_total = 0.0
        with torch.no_grad():
            for patch, pressure, temp in test_loader:
                patch, pressure, temp = patch.to(device), pressure.to(device), temp.to(device)
                preds = model(patch, pressure)
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
        "pressure_mean": train_ds.pressure_mean,
        "pressure_std": train_ds.pressure_std,
        "in_channels": patches.shape[1],
        "best_test_rmse": best_rmse,
    }, out_dir / "cnn_model.pt")
    print(f"Saved best CNN model checkpoint to {out_dir / 'cnn_model.pt'}")

    return model


if __name__ == "__main__":
    train_model()