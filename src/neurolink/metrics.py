"""Evaluation metrics.

On Dice and IoU
---------------
The source material for this project asks us to "validate with dice score and
intersection over union". Those are *segmentation* metrics: they measure the
spatial overlap between a predicted region and a ground-truth region,

    Dice = 2|A cap B| / (|A| + |B|)     IoU = |A cap B| / |A cup B|

A classifier that emits four probabilities has no predicted region, so there is
nothing to intersect. Computing them on a classification output would silently
degenerate: for single-label predictions Dice collapses to the F1 score and IoU
to the Jaccard index, and reporting either as if it validated a *segmentation*
would be a category error.

So we do two things instead of one:
  1. Report the metrics this task actually needs (below), including quadratic
     weighted kappa, because the four classes are ordered CDR scores.
  2. Compute genuine Dice and IoU where they are meaningful -- in explain.py,
     between the model's class activation map and an anatomically derived
     ventricle mask. That measures whether the model attends to the structure
     that actually enlarges in Alzheimer's. Same metrics, valid application.
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, cohen_kappa_score, confusion_matrix,
    f1_score, precision_recall_fscore_support, roc_auc_score, average_precision_score,
)

from .constants import COLLAPSE_3CLASS, COLLAPSE_BINARY, N_CLASSES


def _remap(y: np.ndarray, mapping: dict) -> np.ndarray:
    return np.vectorize(mapping.get)(y)


def collapse_probs(probs: np.ndarray, mapping: dict, n_out: int) -> np.ndarray:
    """Sum 4-class probabilities into a coarser task's classes."""
    out = np.zeros((len(probs), n_out))
    for src, dst in mapping.items():
        out[:, dst] += probs[:, src]
    return out


def classification_metrics(y_true: np.ndarray, y_pred: np.ndarray, probs: np.ndarray) -> dict:
    """Metrics for the 4-class task, plus the two collapsed views."""
    m = {
        "n": int(len(y_true)),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        # Classes are ordinal CDR scores: quadratic weighting penalises a
        # Non->Moderate confusion far more than Non->Very mild. Plain accuracy
        # treats those two errors as identical, which for staging is wrong.
        "quadratic_kappa": float(cohen_kappa_score(y_true, y_pred, weights="quadratic")),
        "confusion_matrix": confusion_matrix(
            y_true, y_pred, labels=list(range(N_CLASSES))).tolist(),
    }

    p, r, f, s = precision_recall_fscore_support(
        y_true, y_pred, labels=list(range(N_CLASSES)), zero_division=0)
    m["per_class"] = [
        {"precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "support": int(s[i])}
        for i in range(N_CLASSES)
    ]

    # 3-class collapse (Mild + Moderate merged: Moderate alone has 2 subjects)
    y3t, y3p = _remap(y_true, COLLAPSE_3CLASS), _remap(y_pred, COLLAPSE_3CLASS)
    m["collapsed_3class"] = {
        "balanced_accuracy": float(balanced_accuracy_score(y3t, y3p)),
        "macro_f1": float(f1_score(y3t, y3p, average="macro", zero_division=0)),
        "confusion_matrix": confusion_matrix(y3t, y3p, labels=[0, 1, 2]).tolist(),
    }

    # Binary screening: the clinically framed headline.
    ybt, ybp = _remap(y_true, COLLAPSE_BINARY), _remap(y_pred, COLLAPSE_BINARY)
    pb = collapse_probs(probs, COLLAPSE_BINARY, 2)[:, 1]
    m["binary_screening"] = {
        "accuracy": float(accuracy_score(ybt, ybp)),
        "balanced_accuracy": float(balanced_accuracy_score(ybt, ybp)),
        "sensitivity": float(r_ := _safe_recall(ybt, ybp, 1)),
        "specificity": float(_safe_recall(ybt, ybp, 0)),
        "roc_auc": float(roc_auc_score(ybt, pb)) if len(np.unique(ybt)) > 1 else float("nan"),
        "pr_auc": float(average_precision_score(ybt, pb)) if len(np.unique(ybt)) > 1 else float("nan"),
        "confusion_matrix": confusion_matrix(ybt, ybp, labels=[0, 1]).tolist(),
    }
    return m


def _safe_recall(y_true: np.ndarray, y_pred: np.ndarray, cls: int) -> float:
    mask = y_true == cls
    return float((y_pred[mask] == cls).mean()) if mask.any() else float("nan")


def aggregate_to_subjects(
    probs: np.ndarray, y_true: np.ndarray, subjects: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Average slice probabilities within each subject.

    The clinically meaningful unit is the person, not the slice. A radiologist
    reads a whole volume, not one axial cut, and our 347 subjects are the real
    sample size -- so this is the number that should be quoted.
    """
    uniq = np.unique(subjects)
    P = np.stack([probs[subjects == s].mean(axis=0) for s in uniq])
    Y = np.array([y_true[subjects == s][0] for s in uniq])
    return P, Y, uniq


def expected_calibration_error(probs: np.ndarray, y_true: np.ndarray, n_bins: int = 15) -> float:
    """Gap between confidence and correctness. A model that says 90% should be
    right 90% of the time; if it is not, its confidence cannot drive referral."""
    conf, pred = probs.max(1), probs.argmax(1)
    correct = (pred == y_true).astype(float)
    bins = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for lo, hi in zip(bins[:-1], bins[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.sum():
            ece += m.mean() * abs(correct[m].mean() - conf[m].mean())
    return float(ece)


def abstention_curve(probs: np.ndarray, y_true: np.ndarray, n_points: int = 21) -> list[dict]:
    """Accuracy as a function of coverage.

    Answers the only question that matters for deployment: if the model refers
    its least-confident cases to a clinician, how good is what remains?
    """
    conf, pred = probs.max(1), probs.argmax(1)
    order = np.argsort(-conf)
    out = []
    for cov in np.linspace(0.1, 1.0, n_points):
        k = max(1, int(round(cov * len(order))))
        sel = order[:k]
        out.append({
            "coverage": float(k / len(order)),
            "accuracy": float((pred[sel] == y_true[sel]).mean()),
            "balanced_accuracy": float(balanced_accuracy_score(y_true[sel], pred[sel]))
            if len(np.unique(y_true[sel])) > 1 else float("nan"),
            "min_confidence": float(conf[sel].min()),
        })
    return out


def dice_score(a: np.ndarray, b: np.ndarray) -> float:
    """Genuine Dice between two binary masks. Used in explain.py on CAM vs ventricles."""
    a, b = a.astype(bool), b.astype(bool)
    denom = a.sum() + b.sum()
    return float(2.0 * (a & b).sum() / denom) if denom else float("nan")


def iou_score(a: np.ndarray, b: np.ndarray) -> float:
    """Genuine IoU between two binary masks."""
    a, b = a.astype(bool), b.astype(bool)
    union = (a | b).sum()
    return float((a & b).sum() / union) if union else float("nan")


def roc_points(y_true: np.ndarray, scores: np.ndarray, max_points: int = 120) -> list[dict]:
    """ROC curve as a list of points, thinned so the website can plot it directly.

    Stored rather than only summarised, because an AUC of 0.87 says nothing about
    the shape of the trade-off, and the shape is what tells a reader whether the
    model is usable at the operating point they care about.
    """
    from sklearn.metrics import roc_curve

    if len(np.unique(y_true)) < 2:
        return []
    fpr, tpr, thr = roc_curve(y_true, scores)
    if len(fpr) > max_points:
        idx = np.unique(np.linspace(0, len(fpr) - 1, max_points).astype(int))
        fpr, tpr, thr = fpr[idx], tpr[idx], thr[idx]
    return [{"fpr": round(float(a), 4), "tpr": round(float(b), 4),
             "threshold": round(float(c), 4) if np.isfinite(c) else None}
            for a, b, c in zip(fpr, tpr, thr)]


def reliability_points(probs: np.ndarray, y_true: np.ndarray, n_bins: int = 10) -> list[dict]:
    """Confidence vs observed accuracy, binned. Empty bins are dropped."""
    conf, pred = probs.max(1), probs.argmax(1)
    correct = (pred == y_true).astype(float)
    edges = np.linspace(0, 1, n_bins + 1)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.sum() >= 3:
            out.append({"confidence": round(float(conf[m].mean()), 4),
                        "accuracy": round(float(correct[m].mean()), 4),
                        "n": int(m.sum())})
    return out


def accuracy_by_slice_position(
    probs: np.ndarray, y_true: np.ndarray, slice_idx: np.ndarray
) -> list[dict]:
    """How performance varies with where in the brain the slice was taken.

    Slices 100-160 run from near the skull base up through the ventricles. If
    the model is reading ventricular anatomy, mid-range slices should carry more
    signal than the lowest ones, and that is checkable rather than assumed.
    """
    pred = probs.argmax(1)
    out = []
    for s in np.unique(slice_idx):
        m = slice_idx == s
        if m.sum() < 20:
            continue
        out.append({"slice": int(s), "n": int(m.sum()),
                    "accuracy": round(float((pred[m] == y_true[m]).mean()), 4),
                    "balanced_accuracy": round(float(balanced_accuracy_score(
                        y_true[m], pred[m])), 4) if len(np.unique(y_true[m])) > 1 else None})
    return out
