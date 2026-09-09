
"""
CNN encoder + MLP decoder (single-day version, 2 inputs: patch, pressure).
"""

import torch
import torch.nn as nn

from src.models.cnn_encoder import CNNEncoder
from src.models.decoder import Decoder


class OceanEmbedModel(nn.Module):
    def __init__(self, in_channels=6, latent_dim=64, hidden_dim=64):
        super().__init__()
        self.encoder = CNNEncoder(in_channels=in_channels, latent_dim=latent_dim)
        self.decoder = Decoder(latent_dim=latent_dim, hidden_dim=hidden_dim)

    def forward(self, patch, pressure):
        latent = self.encoder(patch)
        temp = self.decoder(latent, pressure)
        return temp
