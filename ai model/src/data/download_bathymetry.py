"""Download GEBCO bathymetry (one-time download).

Phase 1: Fetch global bathymetry data for the specified region.
"""

import os
import logging
from datetime import datetime

import numpy as np
import xarray as xr

logger = logging.getLogger(__name__)


def download_gebco(
    lat_min: float,
    lat_max: float,
    lon_min: float,
    lon_max: float,
) -> xr.Dataset:
    """
    Download GEBCO (General Bathymetric Chart of the Oceans) data.

    Args:
        lat_min: Minimum latitude
        lat_max: Maximum latitude
        lon_min: Minimum longitude
        lon_max: Maximum longitude

    Returns:
        xarray Dataset with bathymetry data
    """
    # TODO: Implement GEBCO download (one-time, then cache locally)
    logger.info(f"Downloading GEBCO bathymetry data")
    pass


def save_bathymetry_data(data: xr.Dataset, output_dir: str) -> None:
    """Save bathymetry data to netCDF."""
    # TODO: Save to data/raw/bathymetry/
    logger.info(f"Saving bathymetry data to {output_dir}")
    pass


if __name__ == "__main__":
    # TODO: Load config, call download_gebco(), save_bathymetry_data()
    pass
