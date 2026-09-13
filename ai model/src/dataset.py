"""
Top-level dataset module for OceanEmbed.

Provides shared PyTorch Dataset and DataLoader classes used across both
training pipelines and batch/evaluation inference workflows.
Bridges src/data/dataset.py to the top-level src.dataset module path.
"""

from src.data.dataset import OceanEmbedDataset, get_dataloaders

__all__ = ["OceanEmbedDataset", "get_dataloaders"]
