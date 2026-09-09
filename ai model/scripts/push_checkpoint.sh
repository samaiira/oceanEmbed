#!/bin/bash

# Helper script to push trained checkpoint to GitHub or Kaggle

set -e

CHECKPOINT_PATH=$1
DESTINATION=$2  # "github" or "kaggle"

if [ -z "$CHECKPOINT_PATH" ] || [ -z "$DESTINATION" ]; then
    echo "Usage: ./push_checkpoint.sh <checkpoint_path> <github|kaggle>"
    exit 1
fi

if [ ! -f "$CHECKPOINT_PATH" ]; then
    echo "Error: Checkpoint not found at $CHECKPOINT_PATH"
    exit 1
fi

echo "Pushing checkpoint to $DESTINATION..."

if [ "$DESTINATION" = "github" ]; then
    # TODO: Push to GitHub (Git LFS or Releases)
    echo "Pushing to GitHub..."
    # git add "$CHECKPOINT_PATH"
    # git commit -m "Add trained model checkpoint: $(basename $CHECKPOINT_PATH)"
    # git push origin main
    
elif [ "$DESTINATION" = "kaggle" ]; then
    # TODO: Push to Kaggle Datasets
    echo "Pushing to Kaggle Datasets..."
    # kaggle datasets version -m "Updated model checkpoint"
    
else
    echo "Error: Unknown destination $DESTINATION"
    exit 1
fi

echo "Done!"
