# OceanEmbed

Deep learning framework for reconstructing subsurface ocean temperature (surface to ~2000m) from satellite surface observations, validated against real Argo float measurements.

## Region
North Indian Ocean (Arabian Sea + Bay of Bengal): 5–30°N, 45–105°E

## Current Model
- **Inputs:** Sea Surface Temperature (SST), Sea Surface Height Anomaly (SSHa), Sea Surface Salinity (SSS), pressure (depth proxy)
- **Output:** Predicted temperature at given depth
- **Architecture:** 3-layer MLP (PyTorch)
- **Test RMSE:** 0.554°C (overall), evaluated on held-out Argo floats never seen during training

## Results by Depth Band
| Depth Band | RMSE (°C) |
|---|---|
| Shallow (0–50m) | 0.609 |
| Thermocline (50–200m) | 0.856 |
| Mid (200–1000m) | 0.524 |
| Deep (1000m+) | 0.242 |

## Setup
```bash
pip install -r requirements.txt
```

## Pipeline
```bash
python -m src.data.download_argo
python -m src.data.download_sst
python -m src.data.download_ssha
python -m src.data.download_sss
python -m src.data.clean_argo
python -m src.data.match_argo_to_grid
python -m src.data.build_dataset
python -m src.training.train
python -m src.evaluation.plot_profiles
```

## Quick Inference (no retraining needed)
```bash
python -m src.inference --sst 27.5 --ssha 0.05 --sss 35.2
```

## Data Sources
- Argo floats: [Argovis](https://argovis.colorado.edu)
- SST: [NOAA OISST v2.1](https://www.ncei.noaa.gov)
- SSHa, SSS: [Copernicus Marine Service](https://data.marine.copernicus.eu)

## Future Work
- Add ocean current and wind data (currently downloaded but not used in the final model — testing showed no clear benefit with a point-wise MLP)
- Extend to full multi-year date range
- Upgrade to CNN/Transformer encoder to capture spatial patterns (eddies, fronts) rather than treating each point independently