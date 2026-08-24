"""The leakage experiment.

Trains the SAME architecture, for the same number of epochs, with the same seed,
on two splits of the same data that differ in exactly one respect:

  A. random_slice -- slices shuffled individually. Every one of the 347 subjects
     ends up in both train and test.
  B. holdout      -- split by subject. No person crosses the boundary.

Any difference in the resulting scores is caused by leakage and nothing else.
This is the number the website leads with, because it is the reason a "99%
accurate Alzheimer's detector" can be built in an afternoon and mean nothing.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]


def train(tag: str, split_mode: str, model: str, epochs: int, extra: list[str]) -> None:
    cmd = [sys.executable, "-m", "src.neurolink.train",
           "--model", model, "--split-mode", split_mode,
           "--epochs", str(epochs), "--tag", tag, *extra]
    print(f"\n$ {' '.join(cmd)}\n", flush=True)
    subprocess.run(cmd, cwd=REPO, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="resnet18")
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--slice-stride", type=int, default=2)
    ap.add_argument("--batch-size", type=int, default=96)
    a, extra = ap.parse_known_args()

    common = ["--slice-stride", str(a.slice_stride), "--batch-size", str(a.batch_size), *extra]
    runs = {
        "leaky_random_slice": "random_slice",
        "honest_subject_split": "holdout",
    }
    for tag, mode in runs.items():
        train(f"leakage_{tag}", mode, a.model, a.epochs, common)

    from ..evaluate import evaluate_run, print_report
    results = {}
    for tag in runs:
        e = evaluate_run(REPO / "runs" / f"leakage_{tag}")
        print_report(e)
        results[tag] = e

    leaky = results["leaky_random_slice"]["slice_level"]
    honest_sl = results["honest_subject_split"]["slice_level"]
    honest_sb = results["honest_subject_split"]["subject_level"]

    comparison = {
        "model": a.model, "epochs": a.epochs,
        "leaky_random_split": {
            "accuracy": leaky["accuracy"],
            "balanced_accuracy": leaky["balanced_accuracy"],
            "macro_f1": leaky["macro_f1"],
            "subjects_in_both_train_and_test": 347,
        },
        "honest_subject_split_slice_level": {
            "accuracy": honest_sl["accuracy"],
            "balanced_accuracy": honest_sl["balanced_accuracy"],
            "macro_f1": honest_sl["macro_f1"],
        },
        "honest_subject_split_subject_level": {
            "accuracy": honest_sb["accuracy"],
            "balanced_accuracy": honest_sb["balanced_accuracy"],
            "macro_f1": honest_sb["macro_f1"],
        },
        "inflation": {
            "accuracy_points": round(
                100 * (leaky["accuracy"] - honest_sl["accuracy"]), 1),
            "balanced_accuracy_points": round(
                100 * (leaky["balanced_accuracy"] - honest_sl["balanced_accuracy"]), 1),
        },
    }
    out = REPO / "reports" / "leakage_experiment.json"
    out.write_text(json.dumps(comparison, indent=2))

    print(f"\n{'=' * 72}\nLEAKAGE EXPERIMENT — identical model, identical epochs\n{'=' * 72}")
    print(f"  random slice split (leaky)  balanced acc: "
          f"{leaky['balanced_accuracy']:.4f}   accuracy: {leaky['accuracy']:.4f}")
    print(f"  subject split (honest)      balanced acc: "
          f"{honest_sl['balanced_accuracy']:.4f}   accuracy: {honest_sl['accuracy']:.4f}")
    print(f"\n  Leakage inflated accuracy by "
          f"{comparison['inflation']['accuracy_points']} percentage points.")
    print(f"  Wrote {out}")


if __name__ == "__main__":
    main()
