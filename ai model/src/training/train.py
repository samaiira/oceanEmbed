"""
Train the baseline MLP on SST + pressure -> temperature.

Usage:
    python -m src.training.train
"""

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from pathlib import Path

from src.models.baseline_regression import BaselineMLP


def load_processed_data(data_dir="data/processed"):
    data_dir = Path(data_dir)
    X_train = np.load(data_dir / "X_train.npy")
    y_train = np.load(data_dir / "y_train.npy")
    X_test = np.load(data_dir / "X_test.npy")
    y_test = np.load(data_dir / "y_test.npy")
    return X_train, y_train, X_test, y_test


def normalize(X_train, X_test):
    """
    Normalize features to roughly zero mean / unit variance,
    using train set statistics only (avoid test leakage).
    """
    mean = X_train.mean(axis=0)
    std = X_train.std(axis=0)
    std[std == 0] = 1.0  # avoid divide-by-zero

    X_train_norm = (X_train - mean) / std
    X_test_norm = (X_test - mean) / std

    return X_train_norm, X_test_norm, mean, std


def train_model(epochs=30, batch_size=512, lr=1e-3, device=None):
    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    X_train, y_train, X_test, y_test = load_processed_data()
    X_train_norm, X_test_norm, mean, std = normalize(X_train, X_test)

    train_ds = TensorDataset(
        torch.tensor(X_train_norm, dtype=torch.float32),
        torch.tensor(y_train, dtype=torch.float32)
    )
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)

    X_test_t = torch.tensor(X_test_norm, dtype=torch.float32).to(device)
    y_test_t = torch.tensor(y_test, dtype=torch.float32).to(device)

    model = BaselineMLP().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0

        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            preds = model(xb)
            loss = loss_fn(preds, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(xb)

        train_loss = total_loss / len(train_ds)

        model.eval()
        with torch.no_grad():
            test_preds = model(X_test_t)
            test_loss = loss_fn(test_preds, y_test_t).item()
            test_rmse = torch.sqrt(torch.tensor(test_loss)).item()

        print(f"Epoch {epoch:3d}/{epochs} | Train MSE: {train_loss:.4f} | Test MSE: {test_loss:.4f} | Test RMSE: {test_rmse:.3f} degC")

    # Save model + normalization stats for later inference
    out_dir = Path("checkpoints")
    out_dir.mkdir(parents=True, exist_ok=True)
    torch.save({
        "model_state": model.state_dict(),
        "mean": mean,
        "std": std,
    }, out_dir / "baseline_mlp.pt")
    print(f"\nSaved model checkpoint to {out_dir / 'baseline_mlp.pt'}")

    return model, mean, std


if __name__ == "__main__":
    train_model()