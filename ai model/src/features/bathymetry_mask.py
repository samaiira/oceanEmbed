"""Bathymetry masking to exclude predictions below seafloor.

Phase 5: Create and apply depth masks based on GEBCO bathymetry.
"""

import logging
from typing import Tuple

import numpy as np
import xarray as xr

logger = logging.getLogger(__name__)


def create_bathymetry_mask(
    bathymetry_data: xr.Dataset,
    grid_lats: np.ndarray,
    grid_lons: np.ndarray,
    max_depth: float = 2000.0,
) -> np.ndarray:
    """
    Create a mask for grid cells based on seafloor depth.

    Args:
        bathymetry_data: xarray Dataset with depth data
        grid_lats: Array of grid latitudes
        grid_lons: Array of grid longitudes
        max_depth: Maximum depth to consider (m)

    Returns:
        Boolean mask array (True = valid, False = land/too deep)
    """
    # TODO: Interpolate bathymetry to grid, create mask
    logger.info(f"Creating bathymetry mask (max depth: {max_depth}m)")
    pass


def apply_depth_mask(
    predictions: np.ndarray,
    mask: np.ndarray,
    fill_value: float = np.nan,
) -> np.ndarray:
    """
    Apply bathymetry mask to predictions.

    Args:
        predictions: Model predictions array
        mask: Boolean mask
        fill_value: Value to use for masked locations

    Returns:
        Masked predictions
    """
    # TODO: Apply mask
    pass


if __name__ == "__main__":
    # TODO: Test masking
    pass
