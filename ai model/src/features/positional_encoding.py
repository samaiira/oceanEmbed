"""Positional encoding for latitude, longitude, and day-of-year.

Phase 5: Add sinusoidal positional encodings to model inputs.
"""

import logging
from typing import Tuple

import numpy as np
import torch

logger = logging.getLogger(__name__)


def encode_lat_lon(
    lat: np.ndarray,
    lon: np.ndarray,
    d_model: int = 64,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create sinusoidal positional encodings for latitude and longitude.

    Args:
        lat: Array of latitude values
        lon: Array of longitude values
        d_model: Encoding dimension

    Returns:
        Tuple of (lat_encodings, lon_encodings)
    """
    # TODO: Implement sinusoidal positional encoding
    logger.info(f"Encoding lat/lon to dimension {d_model}")
    pass


def encode_day_of_year(
    dates: np.ndarray,
    d_model: int = 64,
) -> np.ndarray:
    """
    Create sinusoidal encodings for day-of-year.

    Args:
        dates: Array of date values (datetime64)
        d_model: Encoding dimension

    Returns:
        Array of day-of-year encodings
    """
    # TODO: Implement day-of-year sinusoidal encoding
    logger.info(f"Encoding day-of-year to dimension {d_model}")
    pass


def combine_encodings(
    lat_enc: np.ndarray,
    lon_enc: np.ndarray,
    doy_enc: np.ndarray,
) -> np.ndarray:
    """Combine lat, lon, and day-of-year encodings."""
    # TODO: Implement concatenation/combination
    pass


if __name__ == "__main__":
    # TODO: Test encodings
    pass
