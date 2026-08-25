"""Visual sanity check for preprocessing. Look at this before building the cache."""

from __future__ import annotations

from pathlib import Path

import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from ..constants import CLASS_NAMES
from .preprocess import head_mask, process_one, square_bbox, to_grayscale


def render_probe(repo: Path, size: int, margin: float, clip, n_per_class: int) -> None:
    manifest = pd.read_csv(repo / "cache" / "manifest.csv")

    # Verify the 3 stored channels really are identical before we throw two away.
    print("Channel-identity check on 200 random files:")
    rng = np.random.default_rng(0)
    diffs = []
    for rel in manifest["path"].sample(200, random_state=0):
        raw = cv2.imread(str(repo / "data" / rel), cv2.IMREAD_UNCHANGED)
        if raw.ndim == 3:
            diffs.append(max(np.abs(raw[..., 0].astype(int) - raw[..., 1].astype(int)).max(),
                             np.abs(raw[..., 1].astype(int) - raw[..., 2].astype(int)).max()))
    print(f"  max abs channel difference = {max(diffs)}  "
          f"({'identical -> grayscale is lossless' if max(diffs) == 0 else 'NOT identical!'})")

    rows = []
    for cname in CLASS_NAMES:
        sub = manifest[manifest.class_name == cname]
        # mid-brain slices show ventricles best
        sub = sub[(sub.slice_idx > 125) & (sub.slice_idx < 140)]
        rows.extend(sub.sample(n_per_class, random_state=7).to_dict("records"))

    fig, axes = plt.subplots(len(rows), 4, figsize=(11, 2.7 * len(rows)))
    axes = np.atleast_2d(axes)
    for r, rec in enumerate(rows):
        raw = cv2.imread(str(repo / "data" / rec["path"]), cv2.IMREAD_UNCHANGED)
        gray = to_grayscale(raw)
        side = max(gray.shape)
        sq = cv2.resize(gray, (side, side), interpolation=cv2.INTER_CUBIC)
        m = head_mask(sq)
        x0, y0, x1, y1 = square_bbox(m, margin, sq.shape)
        boxed = cv2.cvtColor(sq, cv2.COLOR_GRAY2BGR)
        cv2.rectangle(boxed, (x0, y0), (x1, y1), (0, 255, 0), 3)
        final, _ = process_one(repo / "data" / rec["path"], size, margin, clip)

        for c, (im, t) in enumerate([
            (gray, f"1. raw {gray.shape[1]}x{gray.shape[0]}"),
            (sq, f"2. un-squashed {side}x{side}"),
            (boxed[..., ::-1], "3. head bbox"),
            (final, f"4. final {size}x{size}"),
        ]):
            axes[r, c].imshow(im, cmap=None if im.ndim == 3 else "gray")
            axes[r, c].set_title(t, fontsize=8)
            axes[r, c].axis("off")
        axes[r, 0].set_ylabel(rec["class_name"], fontsize=8)
        axes[r, 0].text(-0.08, 0.5, f'{rec["class_name"]}\n{rec["subject"]}',
                        transform=axes[r, 0].transAxes, rotation=90,
                        va="center", ha="center", fontsize=7)

    fig.suptitle("Preprocessing pipeline, verify the brain is centred and undistorted", fontsize=11)
    fig.tight_layout()
    out = repo / "reports" / "figures" / "preprocessing_probe.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, dpi=110, bbox_inches="tight")
    print(f"Wrote {out}")
