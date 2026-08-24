"""Figures for the report and the website."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from .constants import SHORT_NAMES

REPO = Path(__file__).resolve().parents[2]
FIG = REPO / "reports" / "figures"

INK, MUTED, ACCENT, WARN = "#1a1a2e", "#6b7280", "#2563eb", "#dc2626"
plt.rcParams.update({
    "figure.facecolor": "white", "axes.facecolor": "white",
    "axes.edgecolor": "#d1d5db", "axes.labelcolor": INK, "text.color": INK,
    "xtick.color": MUTED, "ytick.color": MUTED, "font.size": 10,
    "axes.spines.top": False, "axes.spines.right": False,
})


def leakage_bar(comparison: dict, out: Path) -> None:
    """The headline chart."""
    leaky = comparison["leaky_random_split"]
    slice_h = comparison["honest_subject_split_slice_level"]
    subj_h = comparison["honest_subject_split_subject_level"]

    labels = ["Random slice split\n(the naive approach)",
              "Subject split\n(slice-level)",
              "Subject split\n(subject-level)"]
    acc = [leaky["accuracy"], slice_h["accuracy"], subj_h["accuracy"]]
    bal = [leaky["balanced_accuracy"], slice_h["balanced_accuracy"], subj_h["balanced_accuracy"]]

    x = np.arange(len(labels)); w = 0.36
    fig, ax = plt.subplots(figsize=(8.5, 4.6))
    b1 = ax.bar(x - w/2, acc, w, label="Accuracy", color=[WARN, ACCENT, ACCENT])
    b2 = ax.bar(x + w/2, bal, w, label="Balanced accuracy",
                color=[WARN, ACCENT, ACCENT], alpha=0.45)
    for bars in (b1, b2):
        for b in bars:
            ax.text(b.get_x() + b.get_width()/2, b.get_height() + 0.015,
                    f"{b.get_height():.3f}", ha="center", fontsize=8.5, color=INK)
    ax.axhline(0.25, ls=":", color=MUTED, lw=1)
    ax.text(len(labels) - 0.5, 0.262, "chance (balanced)", ha="right", fontsize=8, color=MUTED)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylim(0, 1.08); ax.set_ylabel("Score")
    ax.set_title("Identical model, identical epochs — only the split differs", fontsize=11.5)
    ax.legend(frameon=False, loc="upper right", fontsize=9)
    fig.tight_layout(); fig.savefig(out, dpi=150, bbox_inches="tight"); plt.close(fig)


def confusion(cm: np.ndarray, title: str, out: Path, names=None) -> None:
    names = names or SHORT_NAMES
    cm = np.asarray(cm, dtype=float)
    norm = cm / np.maximum(cm.sum(axis=1, keepdims=True), 1)
    fig, ax = plt.subplots(figsize=(5.6, 4.9))
    im = ax.imshow(norm, cmap="Blues", vmin=0, vmax=1)
    for i in range(len(names)):
        for j in range(len(names)):
            ax.text(j, i, f"{int(cm[i,j])}\n{norm[i,j]*100:.0f}%", ha="center", va="center",
                    fontsize=8.5, color="white" if norm[i, j] > 0.5 else INK)
    ax.set_xticks(range(len(names))); ax.set_xticklabels(names, rotation=30, ha="right", fontsize=9)
    ax.set_yticks(range(len(names))); ax.set_yticklabels(names, fontsize=9)
    ax.set_xlabel("Predicted"); ax.set_ylabel("True")
    ax.set_title(title, fontsize=11)
    fig.colorbar(im, ax=ax, fraction=0.045, label="row-normalised")
    fig.tight_layout(); fig.savefig(out, dpi=150, bbox_inches="tight"); plt.close(fig)


def abstention(curve: list[dict], out: Path) -> None:
    cov = [c["coverage"] for c in curve]
    acc = [c["accuracy"] for c in curve]
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    ax.plot(cov, acc, "-o", color=ACCENT, ms=4)
    ax.set_xlabel("Coverage — fraction of patients the model rules on")
    ax.set_ylabel("Accuracy on those it rules on")
    ax.set_title("Deferring the least-confident cases to a clinician", fontsize=11)
    ax.grid(alpha=0.25)
    fig.tight_layout(); fig.savefig(out, dpi=150, bbox_inches="tight"); plt.close(fig)


def reliability(probs: np.ndarray, y: np.ndarray, out: Path, n_bins: int = 12) -> None:
    conf, pred = probs.max(1), probs.argmax(1)
    correct = (pred == y).astype(float)
    bins = np.linspace(0, 1, n_bins + 1)
    xs, ys, ns = [], [], []
    for lo, hi in zip(bins[:-1], bins[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.sum() >= 5:
            xs.append(conf[m].mean()); ys.append(correct[m].mean()); ns.append(int(m.sum()))
    fig, ax = plt.subplots(figsize=(5.4, 5.0))
    ax.plot([0, 1], [0, 1], ls="--", color=MUTED, lw=1, label="perfect calibration")
    ax.plot(xs, ys, "-o", color=ACCENT, ms=5, label="model")
    ax.set_xlabel("Confidence"); ax.set_ylabel("Observed accuracy")
    ax.set_title("Calibration", fontsize=11); ax.legend(frameon=False, fontsize=9)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.grid(alpha=0.25)
    fig.tight_layout(); fig.savefig(out, dpi=150, bbox_inches="tight"); plt.close(fig)


def dataset_overview(manifest, out: Path) -> None:
    """Images vs people — the chart that explains why this project is hard."""
    g = manifest.groupby("class_name").agg(images=("path", "size"),
                                           subjects=("subject", "nunique"),
                                           cdr=("cdr", "first")).sort_values("cdr")
    names = [n.replace(" Dementia", "").replace("Non Demented", "Non-demented") for n in g.index]
    x = np.arange(len(g))
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10.5, 4.1))
    a1.bar(x, g["images"], color=ACCENT); a1.set_title("Images (what you see in the folder)", fontsize=10.5)
    a2.bar(x, g["subjects"], color=WARN); a2.set_title("Actual people (the real sample size)", fontsize=10.5)
    for ax, vals in ((a1, g["images"]), (a2, g["subjects"])):
        ax.set_xticks(x); ax.set_xticklabels(names, rotation=20, ha="right", fontsize=9)
        for i, v in enumerate(vals):
            ax.text(i, v, f"{v:,}", ha="center", va="bottom", fontsize=9)
        ax.set_ylim(0, max(vals) * 1.18)
    fig.tight_layout(); fig.savefig(out, dpi=150, bbox_inches="tight"); plt.close(fig)
