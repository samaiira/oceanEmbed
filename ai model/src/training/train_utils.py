"""Training utilities (checkpointing, early stopping, logging).

Helper functions and classes for training.
"""

import logging
import os
from typing import Dict, Optional

import torch
import torch.nn as nn

logger = logging.getLogger(__name__)


class EarlyStoppingCallback:
    """Early stopping callback based on validation loss."""

    def __init__(self, patience: int = 10, min_delta: float = 1e-4):
        """
        Initialize EarlyStoppingCallback.

        Args:
            patience: Number of epochs with no improvement before stopping
            min_delta: Minimum change to qualify as improvement
        """
        self.patience = patience
        self.min_delta = min_delta
        self.counter = 0
        self.best_loss = None
        self.stop_training = False

    def __call__(self, val_loss: float) -> bool:
        """
        Check if training should stop.

        Args:
            val_loss: Current validation loss

        Returns:
            True if should stop, False otherwise
        """
        # TODO: Implement early stopping logic
        pass


class CheckpointManager:
    """Manages model checkpointing."""

    def __init__(self, checkpoint_dir: str, keep_best_k: int = 3):
        """
        Initialize CheckpointManager.

        Args:
            checkpoint_dir: Directory for checkpoints
            keep_best_k: Number of best checkpoints to keep
        """
        self.checkpoint_dir = checkpoint_dir
        self.keep_best_k = keep_best_k
        os.makedirs(checkpoint_dir, exist_ok=True)

    def save_checkpoint(
        self,
        model: nn.Module,
        optimizer: torch.optim.Optimizer,
        epoch: int,
        loss: float,
    ) -> None:
        """
        Save checkpoint.

        Args:
            model: Model to save
            optimizer: Optimizer state
            epoch: Current epoch
            loss: Current loss
        """
        # TODO: Save checkpoint and manage disk space
        pass

    def load_best_checkpoint(self, model: nn.Module) -> None:
        """Load best checkpoint into model."""
        # TODO: Load best checkpoint
        pass


def log_metrics(
    metrics: Dict,
    step: int,
    logger_instance=None,
) -> None:
    """
    Log metrics (optionally to tensorboard/wandb).

    Args:
        metrics: Dict of metric names to values
        step: Current step/epoch
        logger_instance: Optional logger (tensorboard, wandb, etc.)
    """
    # TODO: Implement metric logging
    pass


if __name__ == "__main__":
    # TODO: Test utilities
    pass
