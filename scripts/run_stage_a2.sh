#!/usr/bin/env bash
# Stage A2 -- a corrected primary model, run AFTER Stage A.
#
# Stage A applies inverse-frequency class weights on top of an already-balanced
# sampler. That double correction gives Moderate Dementia 6x the gradient weight
# of every other class, and Moderate has exactly one training subject. The two
# leakage runs must keep those identical settings for their comparison to mean
# anything -- so instead of changing them, this trains one more model with the
# sampler doing the balancing alone, and lets the numbers decide which becomes
# the model the website ships.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python

$PY -m src.neurolink.train --model resnet18 --split-mode holdout --epochs 8 \
    --train-size 160 --slice-stride 3 --val-stride 4 --num-workers 0 --batch-size 96 \
    --class-weight-mode none --tag primary_resnet18_sampler_only

$PY -m src.neurolink.evaluate primary_resnet18_sampler_only
echo "Compare against runs/leakage_honest_subject_split before choosing the shipped model."
