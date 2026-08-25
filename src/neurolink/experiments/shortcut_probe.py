"""Is the model reading anatomy, or a confound?

Retrains on images with the brain erased -- skull rim, scalp and background
survive, the parenchyma does not. There is no dementia information left in such
an image. If the model still scores well above chance, then something outside the
brain correlates with the label: head size, scanner settings, acquisition-era
artefacts, JPEG characteristics. That would mean the main results are measuring a
confound rather than atrophy.

Reported whichever way it comes out. A near-chance result is what licenses us to
believe the headline numbers; a high result would be the more interesting finding
and would invalidate them.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from .. import jsonio

REPO = Path(__file__).resolve().parents[3]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="resnet18")
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--slice-stride", type=int, default=3)
    a, extra = ap.parse_known_args()

    tag = "probe_brain_removed"
    cmd = [sys.executable, "-m", "src.neurolink.train",
           "--model", a.model, "--split-mode", "holdout", "--mask-mode", "brain_removed",
           "--epochs", str(a.epochs), "--slice-stride", str(a.slice_stride),
           "--tag", tag, *extra]
    print(f"$ {' '.join(cmd)}\n", flush=True)
    subprocess.run(cmd, cwd=REPO, check=True)

    from ..evaluate import evaluate_run, print_report
    e = evaluate_run(REPO / "runs" / tag)
    print_report(e)

    bal = e["subject_level"]["balanced_accuracy"]
    auc = e["subject_level"]["binary_screening"]["roc_auc"]
    chance = 0.25

    # Comparing against a fixed "chance plus a bit" line is the wrong test.
    # What matters is how the brain-removed model does against the real model
    # trained on the same split. If erasing the brain costs almost nothing, the
    # real model was not using the brain for much, whatever its absolute score.
    from ..evaluate import evaluate_run

    comparisons = {}
    for name in ("leakage_honest_subject_split", "scratch_cnn_holdout",
                 "primary_resnet18_sampler_only"):
        d = REPO / "runs" / name
        if (d / "test_predictions.npz").exists():
            c = evaluate_run(d)
            comparisons[name] = {
                "subject_level_balanced_accuracy": c["subject_level"]["balanced_accuracy"],
                "binary_roc_auc": c["subject_level"]["binary_screening"]["roc_auc"],
            }

    best = max(comparisons.values(), key=lambda v: v["subject_level_balanced_accuracy"],
               default=None)
    margin = (best["subject_level_balanced_accuracy"] - bal) if best else None

    if margin is None:
        verdict = ("No comparison run was available, so this number can only be read "
                   "against chance.")
    elif margin < 0.03:
        verdict = (
            "The probe FAILS. A model that cannot see the brain scores about as well as one "
            "that can, so a large part of the apparent skill is coming from something outside "
            "the brain: head size, skull thickness, or some other trait that happens to track "
            "with age and diagnosis. Any result close to this level should not be described as "
            "reading anatomy."
        )
    elif margin < 0.08:
        verdict = (
            "The probe is uncomfortable. Removing the brain costs the model something, but not "
            "much, so part of the score is being carried by features outside the brain."
        )
    else:
        verdict = (
            "The probe passes. Removing the brain costs the model a clear amount, so the real "
            "model is using anatomy rather than an incidental cue."
        )

    out = {
        "subject_level_balanced_accuracy": bal,
        "slice_level_balanced_accuracy": e["slice_level"]["balanced_accuracy"],
        "binary_roc_auc": auc,
        "chance_level": chance,
        "compared_with": comparisons,
        "best_real_model_balanced_accuracy": (
            best["subject_level_balanced_accuracy"] if best else None),
        "margin_over_probe": margin,
        "verdict": verdict,
    }
    jsonio.write(REPO / "reports" / "shortcut_probe.json", out)
    print(f"\n{'=' * 72}\nSHORTCUT PROBE (brain removed)\n{'=' * 72}")
    print(f"  brain removed, subject balanced accuracy: {bal:.4f}  (chance {chance:.2f})")
    for k, v in comparisons.items():
        print(f"  {k:34s} {v['subject_level_balanced_accuracy']:.4f}")
    if margin is not None:
        print(f"  best real model beats the probe by {margin:+.4f}")
    print(f"\n  {verdict}")


if __name__ == "__main__":
    main()
