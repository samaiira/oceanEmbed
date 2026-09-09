

import torch
import torch.nn as nn
from src.models.cnn_encoder import CNNEncoder
from src.models.decoder import Decoder
class OceanEmbedTemporalModel(nn.Module):
    def __init__(self, in_channels=26, latent_dim=64, hidden_dim=64, n_pos_features=4):
        super().__init__()
        self.encoder = CNNEncoder(in_channels=in_channels, latent_dim=latent_dim)
        self.decoder = Decoder(latent_dim=latent_dim + n_pos_features, hidden_dim=hidden_dim)
    def forward(self, patch, pos_features, pressure):
        latent = self.encoder(patch)
        combined = torch.cat([latent, pos_features], dim=1)
        temp = self.decoder(combined, pressure)
        return temp