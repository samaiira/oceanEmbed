"""PyTorch Dataset/DataLoader for training across all phases.

Used in Phases 4–7 and beyond for loading mini-batches of (input, target) pairs.
"""

import logging
from typing import Dict, Tuple, Optional

import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader

logger = logging.getLogger(__name__)


class OceanEmbedDataset(Dataset):
    """
    PyTorch Dataset for oceanembed training data.

    Loads (input, target) pairs from processed tensors.
    """

    def __init__(
        self,
        data_dir: str,
        split: str = "train",
        transform=None,
        normalize: bool = True,
    ):
        """
        Initialize OceanEmbedDataset.

        Args:
            data_dir: Path to processed data directory
            split: "train", "val", or "test"
            transform: Optional torchvision transforms
            normalize: Whether to normalize inputs
        """
        # TODO: Load data from .pt files, store in memory or memory-map
        self.data_dir = data_dir
        self.split = split
        self.transform = transform
        self.normalize = normalize
        self.inputs = None
        self.targets = None

    def __len__(self) -> int:
        """Return dataset size."""
        # TODO: Implement
        return 0

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Get item by index.

        Returns:
            Tuple of (input_tensor, target_tensor)
        """
        # TODO: Implement
        pass


def get_dataloaders(
    data_dir: str,
    batch_size: int = 32,
    num_workers: int = 4,
    pin_memory: bool = True,
) -> Dict[str, DataLoader]:
    """
    Create train/val/test DataLoaders.

    Args:
        data_dir: Path to processed data directory
        batch_size: Batch size
        num_workers: Number of data loading workers
        pin_memory: Pin memory for faster transfer to GPU

    Returns:
        Dict with "train", "val", "test" DataLoaders
    """
    # TODO: Create OceanEmbedDataset instances, wrap in DataLoaders
    logger.info(f"Creating DataLoaders from {data_dir}")
    pass


if __name__ == "__main__":
    # TODO: Test dataset loading
    pass
