"""
CNN encoder with dropout regularization to reduce overfitting
on the small (218-profile) patch dataset.
"""

import torch
import torch.nn as nn


class CNNEncoder(nn.Module):
    def __init__(self, in_channels=6, latent_dim=64, dropout=0.3):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Dropout2d(dropout * 0.5),

            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout2d(dropout * 0.5),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout2d(dropout),
        )
        self.flatten_dim = 64 * 3 * 3
        self.dropout_fc = nn.Dropout(dropout)
        self.fc = nn.Linear(self.flatten_dim, latent_dim)

    def forward(self, x):
        x = self.conv(x)
        x = x.flatten(start_dim=1)
        x = self.dropout_fc(x)
        x = self.fc(x)
        return x