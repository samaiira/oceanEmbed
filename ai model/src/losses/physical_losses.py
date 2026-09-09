
"""
Phase 6: physical constraint losses for temperature-vs-depth profiles.
 
Real ocean profiles are:
  1. Smooth -- temperature doesn't jump erratically between adjacent depths
  2. Mostly monotonic decreasing with depth (occasional inversions exist,
     so this is a SOFT penalty, not a hard constraint)
 
Both penalties operate on a full profile (predictions at multiple depths,
sorted shallow-to-deep, from the SAME location/day) -- not on random,
unrelated rows. That's why training must be restructured to batch by
profile rather than shuffle individual depth-level rows.
"""
 
import torch
 
 
def smoothness_loss(preds_sorted):
    """
    Penalize large second-derivative jumps between adjacent depths.
    preds_sorted: tensor of predicted temperatures, ordered shallow -> deep,
                  for ONE profile.
    """
    if preds_sorted.shape[0] < 3:
        return torch.tensor(0.0, device=preds_sorted.device)
 
    first_diff = preds_sorted[1:] - preds_sorted[:-1]
    second_diff = first_diff[1:] - first_diff[:-1]
    return torch.mean(second_diff ** 2)
 
 
def monotonicity_loss(preds_sorted):
    """
    Softly penalize temperature INCREASING with depth (real inversions do
    occur, so we only penalize the magnitude of violations, not forbid
    them outright).
    preds_sorted: tensor of predicted temperatures, ordered shallow -> deep.
    """
    if preds_sorted.shape[0] < 2:
        return torch.tensor(0.0, device=preds_sorted.device)
 
    diffs = preds_sorted[1:] - preds_sorted[:-1]  # should mostly be <= 0 (cooling with depth)
    violations = torch.clamp(diffs, min=0.0)  # only penalize positive (warming) jumps
    return torch.mean(violations ** 2)
 
 
def combined_physics_loss(preds_sorted, targets_sorted, mse_fn,
                           lambda_smooth=0.05, lambda_mono=0.05):
    """
    Combines standard MSE with the two physical penalties above.
    Returns (total_loss, mse_component, smooth_component, mono_component)
    for logging.
    """
    mse = mse_fn(preds_sorted, targets_sorted)
    smooth = smoothness_loss(preds_sorted)
    mono = monotonicity_loss(preds_sorted)
 
    total = mse + lambda_smooth * smooth + lambda_mono * mono
    return total, mse, smooth, mono
 
