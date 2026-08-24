#!/usr/bin/env bash
# Stage B -- full 5-fold subject-grouped cross-validation.
# Every one of the 347 subjects gets exactly one out-of-fold prediction, so the
# subject-level metrics cover the entire cohort rather than one lucky split.
# Only run this after Stage A has validated the pipeline.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python

MODEL="${MODEL:-resnet18}"
EPOCHS="${EPOCHS:-12}"
STRIDE="${STRIDE:-2}"

for fold in 0 1 2 3 4; do
  echo "### fold $fold / 4  ($MODEL, $EPOCHS epochs, stride $STRIDE)"
  $PY -m src.neurolink.train --model "$MODEL" --split-mode fold --fold "$fold" \
      --epochs "$EPOCHS" --slice-stride "$STRIDE" --tag "cv_${MODEL}_fold${fold}"
done

$PY -m src.neurolink.crossval --model "$MODEL"
$PY -m src.neurolink.report --stage B
echo "Stage B complete."
