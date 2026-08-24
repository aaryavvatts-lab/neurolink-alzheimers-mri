#!/usr/bin/env bash
# Stage A -- validate the whole pipeline on a single subject-grouped holdout.
#
# Settings follow measured throughput on this machine, which shares its GPU with
# other jobs (~61 img/s for ResNet18 at 160px, vs 27 img/s at 176px under heavy
# contention). Measured, not guessed:
#   --train-size 160  GPU-downsampled from the 224 cache. Convolution cost scales
#                     with area; ventricles and cortical bulk are large structures,
#                     so the resolution cut is cheap. It also shrinks the model
#                     download for the browser demo.
#   --slice-stride 3  adjacent axial slices are near-duplicates; this still leaves
#                     ~20 slices per scan per patient.
#   --val-stride 4    validation runs every epoch only to pick a checkpoint.
#   --test-stride 1   the test set is never subsampled for a reported number.
#
# The two leakage runs use IDENTICAL settings. That is the experiment: if they
# differed in any respect, the gap between them would not be attributable to the
# split alone.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python
COMMON="--train-size 160 --slice-stride 3 --val-stride 4 --num-workers 0 --batch-size 96"

echo "### 1/6  manifest + splits  [$(date +%H:%M)]"
$PY -m src.neurolink.data.manifest
$PY -m src.neurolink.data.splits

echo "### 2/6  leakage experiment (the headline)  [$(date +%H:%M)]"
# shellcheck disable=SC2086
$PY -m src.neurolink.experiments.leakage --model resnet18 --epochs 8 \
    --slice-stride 3 --batch-size 96 \
    --train-size 160 --val-stride 4 --num-workers 0

echo "### 3/6  scratch CNN on the honest split  [$(date +%H:%M)]"
# shellcheck disable=SC2086
$PY -m src.neurolink.train --model scratch_cnn --split-mode holdout --epochs 8 \
    $COMMON --tag scratch_cnn_holdout

echo "### 4/6  shortcut probe (brain removed)  [$(date +%H:%M)]"
$PY -m src.neurolink.experiments.shortcut_probe --epochs 6 \
    --slice-stride 4 --train-size 160 --val-stride 4 --num-workers 0

echo "### 5/6  ventricle morphometry baseline  [$(date +%H:%M)]"
$PY -m src.neurolink.baselines.ventricle_lr --slice-stride 4

echo "### 6/6  explainability + report  [$(date +%H:%M)]"
$PY -m src.neurolink.explain --ckpt runs/leakage_honest_subject_split/best.pt --n 400
$PY -m src.neurolink.report --stage A

echo
echo "Stage A complete at $(date +%H:%M). Review reports/results.json."
