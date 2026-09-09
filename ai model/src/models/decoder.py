"""
MLP decoder with dropout for regularization.
"""

import torch
import torch.nn as nn


class Decoder(nn.Module):
    def __init__(self, latent_dim=64, hidden_dim=64, dropout=0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent_dim + 1, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 1),
        )

    def forward(self, latent, pressure):
        x = torch.cat([latent, pressure], dim=1)
        return self.net(x).squeeze(-1)