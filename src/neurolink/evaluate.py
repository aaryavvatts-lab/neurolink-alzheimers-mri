"""Turn a training run's raw predictions into the numbers we actually report.

The headline is always the SUBJECT-level metric. 86,437 slices look like a large
test set, but they come from 347 people; the slice count flatters the apparent
precision of every estimate. A model is right about a patient or it is not.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from .constants import SHORT_NAMES
from .metrics import (
    abstention_curve, aggregate_to_subjects, classification_metrics,
    expected_calibration_error,
)

REPO = Path(__file__).resolve().parents[2]


def fit_temperature(val_probs: np.ndarray, val_y: np.ndarray) -> float:
    """Single-parameter temperature scaling, fitted on validation only.

    Rebalanced sampling plus class weighting leaves a model systematically
    over-confident. Temperature scaling corrects the confidences without moving
    any prediction, which is what makes an abstention policy trustworthy.
    """
    logits = torch.log(torch.as_tensor(val_probs, dtype=torch.float64).clamp_min(1e-12))
    y = torch.as_tensor(val_y, dtype=torch.long)
    log_t = torch.zeros(1, dtype=torch.float64, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=80)

    def closure():
        opt.zero_grad()
        loss = torch.nn.functional.cross_entropy(logits / log_t.exp(), y)
        loss.backward()
        return loss

    opt.step(closure)
    return float(log_t.exp().item())


def apply_temperature(probs: np.ndarray, T: float) -> np.ndarray:
    logits = np.log(np.clip(probs, 1e-12, None)) / T
    e = np.exp(logits - logits.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)


def evaluate_run(run_dir: Path) -> dict:
    d = np.load(run_dir / "test_predictions.npz", allow_pickle=True)
    probs, y, subjects = d["probs"], d["y_true"], d["subjects"].astype(str)
    summary = json.loads((run_dir / "summary.json").read_text())

    T = 1.0
    val_p = run_dir / "val_predictions.npz"
    if val_p.exists():
        v = np.load(val_p, allow_pickle=True)
        try:
            T = fit_temperature(v["probs"], v["y_true"])
        except Exception as e:  # pragma: no cover
            print(f"  temperature fit failed ({e}); using T=1")
    probs_cal = apply_temperature(probs, T)

    slice_m = classification_metrics(y, probs.argmax(1), probs)
    SP, SY, SU = aggregate_to_subjects(probs, y, subjects)
    subj_m = classification_metrics(SY, SP.argmax(1), SP)
    SPc, _, _ = aggregate_to_subjects(probs_cal, y, subjects)

    out = {
        **{k: summary[k] for k in ("tag", "model", "split_mode", "fold", "mask_mode",
                                   "leaking_split", "minutes", "best_epoch",
                                   "n_train_subjects", "n_test_subjects")},
        "slice_level": slice_m,
        "subject_level": subj_m,
        "n_test_subjects_evaluated": int(len(SY)),
        "calibration": {
            "temperature": T,
            "ece_slice_uncalibrated": expected_calibration_error(probs, y),
            "ece_slice_calibrated": expected_calibration_error(probs_cal, y),
            "ece_subject_calibrated": expected_calibration_error(SPc, SY),
        },
        "abstention_subject": abstention_curve(SPc, SY),
        "subject_predictions": [
            {"subject": str(s), "true": int(t), "pred": int(p.argmax()),
             "probs": [round(float(v), 4) for v in p]}
            for s, t, p in zip(SU, SY, SPc)
        ],
    }
    (run_dir / "evaluation.json").write_text(json.dumps(out, indent=2))
    return out


def print_report(e: dict) -> None:
    sl, sb = e["slice_level"], e["subject_level"]
    print(f"\n{'=' * 72}\n{e['tag']}   ({e['model']}, split={e['split_mode']})")
    if e["leaking_split"]:
        print("  *** LEAKING SPLIT -- these numbers are an artefact, not a result ***")
    print(f"{'=' * 72}")
    print(f"{'':22s}{'slice-level':>14s}{'SUBJECT-level':>16s}")
    for name, key in [("accuracy", "accuracy"), ("balanced accuracy", "balanced_accuracy"),
                      ("macro F1", "macro_f1"), ("quadratic kappa", "quadratic_kappa")]:
        print(f"  {name:20s}{sl[key]:>14.4f}{sb[key]:>16.4f}")
    print(f"  {'binary ROC-AUC':20s}{sl['binary_screening']['roc_auc']:>14.4f}"
          f"{sb['binary_screening']['roc_auc']:>16.4f}")
    print(f"  {'binary sensitivity':20s}{sl['binary_screening']['sensitivity']:>14.4f}"
          f"{sb['binary_screening']['sensitivity']:>16.4f}")
    print(f"  {'binary specificity':20s}{sl['binary_screening']['specificity']:>14.4f}"
          f"{sb['binary_screening']['specificity']:>16.4f}")
    print(f"\n  n = {sl['n']:,} slices from {e['n_test_subjects_evaluated']} subjects")
    print(f"  temperature {e['calibration']['temperature']:.3f}, "
          f"ECE {e['calibration']['ece_slice_uncalibrated']:.4f} -> "
          f"{e['calibration']['ece_slice_calibrated']:.4f}")

    print("\n  Subject-level confusion (rows = true, cols = predicted):")
    cm = np.array(sb["confusion_matrix"])
    print("            " + "".join(f"{n:>11s}" for n in SHORT_NAMES))
    for i, n in enumerate(SHORT_NAMES):
        print(f"  {n:>9s} " + "".join(f"{v:>11d}" for v in cm[i]))
    for i, pc in enumerate(sb["per_class"]):
        if pc["support"] and pc["support"] <= 3:
            print(f"  NOTE: '{SHORT_NAMES[i]}' has only {pc['support']} test subject(s) — "
                  f"its per-class numbers are anecdotal, not an estimate.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("runs", nargs="+")
    a = ap.parse_args()
    for r in a.runs:
        print_report(evaluate_run(Path(r) if Path(r).is_absolute() else REPO / "runs" / r))
