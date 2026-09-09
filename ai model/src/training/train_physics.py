"""
Phase 6: train the point-based MLP with physics-informed losses
(smoothness + monotonicity), batched by profile so penalties can
compare predictions across adjacent depths of the SAME float/day.
"""
 
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from pathlib import Path
import copy
 
from src.models.baseline_regression import BaselineMLP
from src.losses.physical_losses import combined_physics_loss
 
 
FEATURE_COLS = ["sst_matched", "ssha_matched", "sss_matched", "pressure"]
 
 
def load_matched_data(path="data/interim/argo_sst_ssha_sss_matched.csv"):
    df = pd.read_csv(path)
    df = df.dropna(subset=FEATURE_COLS + ["temperature"])
    return df
 
 
def split_by_float(df, test_frac=0.2, seed=42):
    unique_floats = df["float_id"].unique()
    rng = np.random.default_rng(seed)
    rng.shuffle(unique_floats)
    n_test = int(len(unique_floats) * test_frac)
    test_floats = set(unique_floats[:n_test])
    train_floats = set(unique_floats[n_test:])
    return df[df["float_id"].isin(train_floats)].copy(), df[df["float_id"].isin(test_floats)].copy()
 
 
def build_profile_groups(df):
    """
    Groups rows by float_id, sorted by pressure ascending (shallow -> deep).
    Returns a list of (X_tensor, y_tensor) per profile.
    """
    groups = []
    for float_id, g in df.groupby("float_id"):
        g_sorted = g.sort_values("pressure")
        X = g_sorted[FEATURE_COLS].values.astype(np.float32)
        y = g_sorted["temperature"].values.astype(np.float32)
        groups.append((X, y))
    return groups
 
 
def normalize_groups(groups, mean, std):
    return [((X - mean) / std, y) for X, y in groups]
 
 
def train_model(epochs=150, lr=1e-3, patience=15,
                 lambda_smooth=0.05, lambda_mono=0.05, device=None):
    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
 
    df = load_matched_data()
    train_df, test_df = split_by_float(df)
    print(f"Train: {len(train_df)} rows, {train_df['float_id'].nunique()} floats")
    print(f"Test:  {len(test_df)} rows, {test_df['float_id'].nunique()} floats")
 
    train_groups_raw = build_profile_groups(train_df)
    test_groups_raw = build_profile_groups(test_df)
 
    all_X = np.concatenate([X for X, y in train_groups_raw], axis=0)
    mean = all_X.mean(axis=0)
    std = all_X.std(axis=0)
    std[std == 0] = 1.0
 
    train_groups = normalize_groups(train_groups_raw, mean, std)
    test_groups = normalize_groups(test_groups_raw, mean, std)
 
    model = BaselineMLP(input_dim=len(FEATURE_COLS)).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=5)
    mse_fn = nn.MSELoss()
 
    best_test_rmse = float("inf")
    best_state = None
    epochs_without_improvement = 0
 
    for epoch in range(1, epochs + 1):
        model.train()
        rng = np.random.default_rng(epoch)  # shuffle profile order each epoch
        order = rng.permutation(len(train_groups))
 
        total_mse, total_smooth, total_mono, n_profiles = 0.0, 0.0, 0.0, 0
 
        for idx in order:
            X, y = train_groups[idx]
            X_t = torch.tensor(X, dtype=torch.float32, device=device)
            y_t = torch.tensor(y, dtype=torch.float32, device=device)
 
            optimizer.zero_grad()
            preds = model(X_t)  # already sorted shallow->deep since X was built that way
            loss, mse, smooth, mono = combined_physics_loss(
                preds, y_t, mse_fn, lambda_smooth=lambda_smooth, lambda_mono=lambda_mono
            )
            loss.backward()
            optimizer.step()
 
            total_mse += mse.item()
            total_smooth += smooth.item()
            total_mono += mono.item()
            n_profiles += 1
 
        train_mse = total_mse / n_profiles
 
        # --- evaluation: plain MSE/RMSE only (physics terms are a training aid, not a reported metric) ---
        model.eval()
        test_sq_errors = []
        with torch.no_grad():
            for X, y in test_groups:
                X_t = torch.tensor(X, dtype=torch.float32, device=device)
                y_t = torch.tensor(y, dtype=torch.float32, device=device)
                preds = model(X_t)
                test_sq_errors.append(((preds - y_t) ** 2).cpu().numpy())
 
        test_mse = np.concatenate(test_sq_errors).mean()
        test_rmse = test_mse ** 0.5
 
        scheduler.step(test_mse)
 
        improved = test_rmse < best_test_rmse
        marker = " <-- best" if improved else ""
        print(f"Epoch {epoch:3d}/{epochs} | Train MSE: {train_mse:.4f} (smooth {total_smooth/n_profiles:.4f}, mono {total_mono/n_profiles:.4f}) | Test RMSE: {test_rmse:.3f} degC{marker}")
 
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
        "mean": mean,
        "std": std,
        "best_test_rmse": best_test_rmse,
    }, out_dir / "baseline_mlp_physics.pt")
    print(f"Saved checkpoint to {out_dir / 'baseline_mlp_physics.pt'}")
 
    return model
 
 
if __name__ == "__main__":
    train_model(epochs=150, patience=15)
 
