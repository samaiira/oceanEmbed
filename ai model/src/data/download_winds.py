"""Download ERA5 wind data via CDS API.

Phase 1: Fetch 10m wind components (U10, V10) from Copernicus Climate Data Store.
"""

import os
import logging
from datetime import datetime

import cdsapi
import xarray as xr

logger = logging.getLogger(__name__)


def download_era5_winds(
    lat_min: float,
    lat_max: float,
    lon_min: float,
    lon_max: float,
    start_date: str,
    end_date: str,
) -> xr.Dataset:
    """
    Download ERA5 wind data (10m U and V components).

    Args:
        lat_min: Minimum latitude
        lat_max: Maximum latitude
        lon_min: Minimum longitude
        lon_max: Maximum longitude
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)

    Returns:
        xarray Dataset with U10 and V10 wind data
    """
    # TODO: Implement ERA5 CDS API request for 10m winds
    logger.info(f"Downloading ERA5 winds from {start_date} to {end_date}")
    pass


def save_winds_data(data: xr.Dataset, output_dir: str) -> None:
    """Save wind data to netCDF."""
    # TODO: Save to data/raw/winds/
    logger.info(f"Saving winds data to {output_dir}")
    pass


if __name__ == "__main__":
    # TODO: Load config, call download_era5_winds(), save_winds_data()
    pass
