"""Train/test split by float ID.

Phase 3: Ensure different Argo floats are in train/test sets to test generalization.
"""

import logging
from typing import Tuple, List

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def split_by_float_id(
    argo_df: pd.DataFrame,
    float_id_col: str = "float_id",
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_seed: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Split data by Argo float ID to ensure different floats in train/test.

    Args:
        argo_df: DataFrame with float_id column
        float_id_col: Name of float ID column
        train_ratio: Fraction of floats for training
        val_ratio: Fraction of floats for validation
        test_ratio: Fraction of floats for testing
        random_seed: Random seed

    Returns:
        Tuple of (train_df, val_df, test_df)
    """
    # TODO: Get unique floats, split by float ID, then split data
    logger.info(f"Splitting {len(argo_df)} profiles by float ID")
    pass


def stratified_split(
    argo_df: pd.DataFrame,
    stratify_col: str = "region",
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_seed: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Stratified split (e.g., by geographic region or season).

    Args:
        argo_df: Input DataFrame
        stratify_col: Column to stratify by
        train_ratio: Training fraction
        val_ratio: Validation fraction
        test_ratio: Testing fraction
        random_seed: Random seed

    Returns:
        Tuple of (train_df, val_df, test_df)
    """
    # TODO: Use sklearn.model_selection.train_test_split with stratify
    logger.info(f"Stratified split by {stratify_col}")
    pass


if __name__ == "__main__":
    # TODO: Test splitting
    pass
