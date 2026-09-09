"""Evaluation metrics for temperature profiles.

Computes RMSE, correlation, bias per depth band.
"""

import logging
from typing import Dict, Tuple

import numpy as np
import torch

logger = logging.getLogger(__name__)


def rmse_per_depth(
    predictions: np.ndarray,
    targets: np.ndarray,
    depths: np.ndarray = None,
) -> Dict:
    """
    Compute RMSE per depth band.

    Args:
        predictions: Model predictions (n_samples, n_depths)
        targets: Target values
        depths: Depth values (optional)

    Returns:
        Dict with per-depth RMSE and overall RMSE
    """
    # TODO: Compute per-depth RMSE
    logger.info(f"Computing RMSE for {predictions.shape[0]} profiles")
    pass


def correlation_per_depth(
    predictions: np.ndarray,
    targets: np.ndarray,
) -> Dict:
    """
    Compute correlation per depth.

    Args:
        predictions: Model predictions
        targets: Target values

    Returns:
        Dict with per-depth correlations
    """
    # TODO: Compute per-depth correlation
    pass


def bias_per_depth(
    predictions: np.ndarray,
    targets: np.ndarray,
) -> Dict:
    """
    Compute bias (mean error) per depth.

    Args:
        predictions: Model predictions
        targets: Target values

    Returns:
        Dict with per-depth biases
    """
    # TODO: Compute per-depth bias
    pass


def compute_all_metrics(
    predictions: np.ndarray,
    targets: np.ndarray,
    depths: np.ndarray = None,
) -> Dict:
    """
    Compute all evaluation metrics.

    Args:
        predictions: Model predictions
        targets: Target values
        depths: Depth values

    Returns:
        Dict with all metrics
    """
    # TODO: Call rmse/correlation/bias functions, combine results
    logger.info("Computing all evaluation metrics")
    pass


if __name__ == "__main__":
    # TODO: Test metrics
    pass
