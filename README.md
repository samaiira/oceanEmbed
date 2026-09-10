# 🌊 OceanEmbed

### See Beneath the Surface

OceanEmbed is a deep learning project that reconstructs **subsurface ocean temperature profiles from surface ocean observations**.

The project explores how widely available surface-level ocean data can be used to estimate temperature conditions beneath the ocean surface, helping bridge the gap between satellite observations and spatially limited subsurface measurements.

---

## 🚀 What I Built

I developed an interactive platform that allows users to:

- Explore the North Indian Ocean study region
- Visualize surface and subsurface ocean information
- Compare predicted and observed temperature profiles
- Analyze model performance across different depth ranges
- Explore the datasets used for reconstruction

---

## 🌊 Study Region

**North Indian Ocean**

**Geographic bounds:** 5–30°N, 45–105°E

The study includes:

- Arabian Sea
- Bay of Bengal

**Evaluation period:** January 2023

---

## 🧠 Model

OceanEmbed uses a:

**Convolutional Encoder + MLP (Fully Connected) Decoder**

The convolutional encoder learns spatial patterns from surface ocean observations, while the MLP decoder reconstructs the corresponding subsurface temperature profile.

```text
Surface Ocean Observations
          ↓
Convolutional Encoder
          ↓
Learned Spatial Features
          ↓
MLP Decoder
          ↓
Subsurface Temperature Profile
