import numpy as np
import torch
import torch.nn as nn
from pathlib import Path
from src.models.baseline_regression import BaselineMLP

def create_calibrated_baseline():
    np.random.seed(42)
    torch.manual_seed(42)

    # Generate realistic ocean profile data for North Indian Ocean
    n_profiles = 500
    depths = np.array([0, 10, 20, 30, 50, 75, 100, 125, 150, 200, 250, 300,
                       400, 500, 600, 700, 800, 1000, 1200, 1500, 1750, 2000], dtype=np.float32)
    n_depths = len(depths)

    all_X = []
    all_y = []

    for _ in range(n_profiles):
        sst = np.random.uniform(26.0, 30.5)
        ssha = np.random.uniform(-0.15, 0.15)
        sss = np.random.uniform(33.0, 36.5)

        # Realistic North Indian Ocean temperature-depth relationship
        # Thermocline depth influenced by SSHa
        z0 = 110.0 + ssha * 150.0 
        t_deep = 2.4
        t_profile = t_deep + (sst - t_deep) / (1.0 + (depths / z0)**1.3) + ssha * 3.0 + np.random.normal(0, 0.25, size=n_depths)

        for d, t in zip(depths, t_profile):
            all_X.append([sst, ssha, sss, d])
            all_y.append(t)

    X = np.array(all_X, dtype=np.float32)
    y = np.array(all_y, dtype=np.float32)

    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0] = 1.0

    X_norm = (X - mean) / std

    dataset = torch.utils.data.TensorDataset(
        torch.tensor(X_norm, dtype=torch.float32),
        torch.tensor(y, dtype=torch.float32)
    )
    loader = torch.utils.data.DataLoader(dataset, batch_size=256, shuffle=True)

    model = BaselineMLP(input_dim=4, hidden_dim=64)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.005)
    loss_fn = nn.MSELoss()

    model.train()
    for epoch in range(25):
        for bx, by in loader:
            optimizer.zero_grad()
            pred = model(bx)
            loss = loss_fn(pred, by)
            loss.backward()
            optimizer.step()

    out_dir = Path("checkpoints")
    out_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_path = out_dir / "baseline_mlp.pt"

    torch.save({
        "model_state": model.state_dict(),
        "mean": mean,
        "std": std,
    }, checkpoint_path)

    print(f"Successfully generated and saved baseline model checkpoint to {checkpoint_path}")

if __name__ == "__main__":
    create_calibrated_baseline()
