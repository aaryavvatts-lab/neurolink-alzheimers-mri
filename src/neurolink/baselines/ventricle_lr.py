"""Hand-crafted-feature baseline: does the CNN actually earn its complexity?

A CNN is only worth deploying if it beats the obvious thing. The obvious thing
here is measuring the ventricles directly -- ventricular enlargement relative to
brain size is the textbook structural marker of the atrophy that accompanies
Alzheimer's, and you can estimate it with thresholding and arithmetic.

If a logistic regression on a handful of such numbers matches the network, the
network has learned nothing a ruler could not measure, and we should say so.

Evaluated on exactly the same subject-grouped split as the CNN.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from tqdm import tqdm

from ..data.preprocess import unpack_masks
from ..explain import ventricle_mask
from ..metrics import aggregate_to_subjects, classification_metrics

REPO = Path(__file__).resolve().parents[3]


def features_for(img: np.ndarray, head: np.ndarray) -> list[float]:
    """Simple, interpretable morphometry proxies."""
    import cv2
    vent = ventricle_mask(img, head)
    r = int(0.10 * min(img.shape))
    brain = cv2.erode(head.astype(np.uint8), np.ones((r, r), np.uint8), 1).astype(bool)
    brain_area = max(brain.sum(), 1)
    inside = img[brain] if brain.any() else img.ravel()
    return [
        vent.sum() / brain_area,          # ventricle-to-brain area ratio  <- the key one
        head.mean(),                      # head area fraction (head size proxy)
        brain_area / max(head.sum(), 1),  # brain-to-head ratio (atrophy proxy)
        float(inside.mean()),
        float(inside.std()),
        float(np.percentile(inside, 10)), # CSF-end of the intensity distribution
        float(np.percentile(inside, 90)), # white-matter end
        float((inside < np.percentile(inside, 22)).mean()),  # dark fraction inside brain
    ]


FEATURE_NAMES = ["ventricle_brain_ratio", "head_area_frac", "brain_head_ratio",
                 "mean_intensity", "std_intensity", "p10_intensity", "p90_intensity",
                 "dark_fraction"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--slice-stride", type=int, default=4, help="features are slow; subsample")
    ap.add_argument("--out", default=str(REPO / "reports" / "baseline_ventricle_lr.json"))
    a = ap.parse_args()

    mf = pd.read_csv(REPO / "cache" / "manifest.csv")
    splits = pd.read_csv(REPO / "cache" / "splits.csv")
    images = np.load(REPO / "cache" / f"slices_{a.size}.npy", mmap_mode="r")
    masks = np.load(REPO / "cache" / f"masks_{a.size}_packed.npy", mmap_mode="r")

    # Mid-brain slices only: the ventricles must be in-plane to be measurable.
    keep = ((mf.slice_idx > 115) & (mf.slice_idx < 150) &
            (mf.slice_idx % a.slice_stride == 0)).to_numpy()
    rows = np.where(keep)[0]
    print(f"extracting features for {len(rows):,} slices...")

    X = np.array([features_for(np.asarray(images[r], dtype=np.uint8),
                               unpack_masks(np.asarray(masks[r]), a.size))
                  for r in tqdm(rows, unit="img")])
    y = mf["label"].to_numpy()[rows]
    subj = mf["subject"].to_numpy()[rows]
    hold = splits["holdout"].to_numpy()[rows]

    tr, te = hold == "train", hold == "test"
    assert not (set(subj[tr]) & set(subj[te])), "subject leakage in baseline split"

    clf = make_pipeline(StandardScaler(),
                        LogisticRegression(max_iter=2000, class_weight="balanced", C=1.0))
    clf.fit(X[tr], y[tr])
    P = clf.predict_proba(X[te])

    slice_m = classification_metrics(y[te], P.argmax(1), P)
    SP, SY, _ = aggregate_to_subjects(P, y[te], subj[te])
    subj_m = classification_metrics(SY, SP.argmax(1), SP)

    coefs = clf[-1].coef_
    out = {
        "n_train_slices": int(tr.sum()), "n_test_slices": int(te.sum()),
        "n_test_subjects": int(len(SY)),
        "slice_level": slice_m, "subject_level": subj_m,
        "feature_names": FEATURE_NAMES,
        "coefficients_per_class": coefs.tolist(),
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(out, indent=2))

    print(f"\n--- ventricle+morphometry logistic regression (subject-grouped split) ---")
    print(f"  slice-level   balanced acc {slice_m['balanced_accuracy']:.4f} | "
          f"kappa {slice_m['quadratic_kappa']:.4f}")
    print(f"  subject-level balanced acc {subj_m['balanced_accuracy']:.4f} | "
          f"kappa {subj_m['quadratic_kappa']:.4f} | "
          f"binary AUC {subj_m['binary_screening']['roc_auc']:.4f}")
    print(f"  wrote {a.out}")


if __name__ == "__main__":
    main()
