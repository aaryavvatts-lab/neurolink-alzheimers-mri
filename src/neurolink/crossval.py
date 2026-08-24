"""Pool the 5 cross-validation folds into one out-of-fold result.

Because folds are subject-disjoint and every subject is in exactly one test fold,
concatenating the five test sets yields one prediction per subject across the
whole cohort of 347 -- the largest honest evaluation this dataset supports.

Fold-to-fold spread is reported as well. With 69 test subjects per fold, that
spread is wide, and quoting a single number without it would overstate how
precisely we know the model's skill.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from .constants import SHORT_NAMES
from .evaluate import evaluate_run
from .metrics import aggregate_to_subjects, classification_metrics
from . import jsonio

REPO = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="resnet18")
    ap.add_argument("--folds", type=int, default=5)
    a = ap.parse_args()

    P, Y, S, per_fold = [], [], [], []
    for k in range(a.folds):
        rd = REPO / "runs" / f"cv_{a.model}_fold{k}"
        if not (rd / "test_predictions.npz").exists():
            print(f"  fold {k}: missing, skipping")
            continue
        e = evaluate_run(rd)
        per_fold.append({
            "fold": k,
            "subject_balanced_accuracy": e["subject_level"]["balanced_accuracy"],
            "subject_quadratic_kappa": e["subject_level"]["quadratic_kappa"],
            "binary_roc_auc": e["subject_level"]["binary_screening"]["roc_auc"],
            "n_test_subjects": e["n_test_subjects_evaluated"],
        })
        d = np.load(rd / "test_predictions.npz", allow_pickle=True)
        P.append(d["probs"]); Y.append(d["y_true"]); S.append(d["subjects"].astype(str))

    if not P:
        raise SystemExit("no completed folds found")

    probs, y, subj = np.concatenate(P), np.concatenate(Y), np.concatenate(S)
    SP, SY, SU = aggregate_to_subjects(probs, y, subj)

    slice_m = classification_metrics(y, probs.argmax(1), probs)
    subj_m = classification_metrics(SY, SP.argmax(1), SP)

    bal = [f["subject_balanced_accuracy"] for f in per_fold]
    out = {
        "model": a.model, "n_folds": len(per_fold),
        "n_subjects_pooled": int(len(SY)), "n_slices_pooled": int(len(y)),
        "per_fold": per_fold,
        "fold_spread": {
            "subject_balanced_accuracy_mean": float(np.mean(bal)),
            "subject_balanced_accuracy_std": float(np.std(bal)),
            "subject_balanced_accuracy_min": float(np.min(bal)),
            "subject_balanced_accuracy_max": float(np.max(bal)),
        },
        "pooled_slice_level": slice_m,
        "pooled_subject_level": subj_m,
    }
    p = REPO / "reports" / f"crossval_{a.model}.json"
    jsonio.write(p, out)

    print(f"\n{'=' * 72}\nPOOLED {len(per_fold)}-FOLD OUT-OF-FOLD RESULT ({a.model})\n{'=' * 72}")
    print(f"  {len(SY)} subjects, {len(y):,} slices")
    print(f"  subject balanced accuracy {subj_m['balanced_accuracy']:.4f}")
    print(f"  subject quadratic kappa   {subj_m['quadratic_kappa']:.4f}")
    print(f"  binary screening ROC-AUC  {subj_m['binary_screening']['roc_auc']:.4f}")
    print(f"  per-fold spread: {np.mean(bal):.4f} +/- {np.std(bal):.4f} "
          f"(min {np.min(bal):.4f}, max {np.max(bal):.4f})")
    print("\n  Subject-level confusion:")
    cm = np.array(subj_m["confusion_matrix"])
    print("            " + "".join(f"{n:>11s}" for n in SHORT_NAMES))
    for i, n in enumerate(SHORT_NAMES):
        print(f"  {n:>9s} " + "".join(f"{v:>11d}" for v in cm[i]))
    print(f"\n  Wrote {p}")


if __name__ == "__main__":
    main()
