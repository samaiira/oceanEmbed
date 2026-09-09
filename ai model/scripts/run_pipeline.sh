#!/bin/bash

# End-to-end pipeline: download -> regrid -> build dataset

set -e  # Exit on error

echo "=== OceanEmbed Data Pipeline ==="

# Create output directories
mkdir -p data/raw data/interim data/processed checkpoints outputs/figures outputs/metrics logs

# Phase 1: Download data
echo "Phase 1: Downloading data..."
python src/data/download_argo.py 2>&1 | tee logs/download_argo.log
python src/data/download_sst.py 2>&1 | tee logs/download_sst.log
python src/data/download_sss.py 2>&1 | tee logs/download_sss.log
python src/data/download_ssha.py 2>&1 | tee logs/download_ssha.log
python src/data/download_currents.py 2>&1 | tee logs/download_currents.log
python src/data/download_winds.py 2>&1 | tee logs/download_winds.log
python src/data/download_bathymetry.py 2>&1 | tee logs/download_bathymetry.log

# Phase 2: Regrid
echo "Phase 2: Regridding to common 0.25° grid..."
python src/data/regrid.py 2>&1 | tee logs/regrid.log

# Phase 2: Match Argo to grid
echo "Phase 2: Matching Argo to grid..."
python src/data/match_argo_to_grid.py 2>&1 | tee logs/match_argo.log

# Phase 2: Build dataset
echo "Phase 2: Building training dataset..."
python src/data/build_dataset.py 2>&1 | tee logs/build_dataset.log

echo "=== Pipeline Complete ==="
echo "Data ready at: data/processed/"
