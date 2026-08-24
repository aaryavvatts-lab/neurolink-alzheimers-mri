"""Explainability, and Dice/IoU applied where they actually mean something.

The reel asks for Dice and IoU. They cannot validate a 4-way classifier (see
metrics.py). But there IS a real spatial question worth asking with them:

    Does the model look at the ventricles?

Ventricular enlargement from surrounding tissue loss is the classic structural
signature of Alzheimer's on MRI -- visible even in our own preprocessing probe,
where the Mild-Dementia subjects show markedly wider ventricles than the
Non-Demented ones. So we:

  1. Derive a ventricle/CSF mask from anatomy (dark central region inside the brain).
  2. Threshold the model's class activation map to a binary "where it looked" region.
  3. Compute genuine Dice and IoU between the two.

Crucially we also compute the same overlap for two null controls -- a centred
blob and the CAM from an untrained network. Without those, a Dice of 0.4 is an
uninterpretable number: it could just mean "both regions are near the middle of
the image". The controls turn it into evidence.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F

from .constants import SHORT_NAMES
from .data.dataset import MEAN, STD
from .metrics import dice_score, iou_score
from .models.transfer import build_model
from . import jsonio

REPO = Path(__file__).resolve().parents[2]


def ventricle_mask(img: np.ndarray, head: np.ndarray, central_frac: float = 0.45) -> np.ndarray:
    """Heuristic lateral-ventricle / central-CSF mask.

    An intensity-and-geometry proxy, NOT a FreeSurfer segmentation: it finds the
    dark CSF-filled region deep inside the brain and near the midline. Good
    enough to ask "is the model attending anywhere near the ventricles?", not
    good enough to quote as a volumetric measurement.

    Two details matter. Closing BEFORE component analysis keeps the lateral
    ventricles as one connected body -- an earlier version opened with a 3x3
    kernel first and shattered them into specks that no attention map could
    plausibly match. And components are kept by how central they are, because
    sulcal CSF is dark too but hugs the outer cortex, whereas the ventricles sit
    at the middle of the slice.
    """
    h, w = img.shape
    # Erode the head mask inward to drop scalp and skull, leaving parenchyma.
    r = int(0.12 * min(h, w))
    brain = cv2.erode(head.astype(np.uint8), np.ones((r, r), np.uint8), iterations=1).astype(bool)
    if brain.sum() < 100:
        return np.zeros_like(img, dtype=bool)

    thr = np.percentile(img[brain], 25)
    dark = (brain & (img <= thr)).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    cy, cx = h / 2, w / 2
    rad = central_frac * min(h, w) / 2
    n, labels, stats, cents = cv2.connectedComponentsWithStats(dark, connectivity=8)
    out = np.zeros_like(dark, dtype=bool)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 0.0015 * h * w:
            continue
        x, y = cents[i]
        if (x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2:
            out |= labels == i
    return out


def model_input(img: np.ndarray, train_size: int, device) -> torch.Tensor:
    """Cache image (224px uint8) -> model input at the resolution it was TRAINED on.

    The cache is 224px but models are trained at a smaller size for speed. Feeding
    224px to a 160px-trained network is a silent distribution shift: it still runs,
    because the head is fully convolutional, but every activation is off.
    """
    x = torch.from_numpy(img)[None].to(device).unsqueeze(1).float().div(255)
    if train_size != x.shape[-1]:
        x = F.interpolate(x, size=(train_size, train_size), mode="bilinear", align_corners=False)
    return x.sub_(MEAN).div_(STD).expand(-1, 3, -1, -1)


def compute_cam(model, x: torch.Tensor, cls: int, size: int) -> np.ndarray:
    """Class activation map, upsampled and min-max scaled to [0, 1]."""
    model.eval()
    with torch.no_grad():
        _, f = model(x, return_features=True)
        w = model.fc.weight[cls]                      # (C,)
        cam = torch.einsum("bchw,c->bhw", f, w)[None] # (1,B,h,w)
        cam = F.interpolate(cam.permute(1, 0, 2, 3), size=(size, size),
                            mode="bilinear", align_corners=False)[:, 0]
    cam = cam.cpu().numpy()
    lo = cam.min(axis=(1, 2), keepdims=True)
    hi = cam.max(axis=(1, 2), keepdims=True)
    return (cam - lo) / np.maximum(hi - lo, 1e-8)


def binarise_cam(cam: np.ndarray, top_frac: float = 0.15) -> np.ndarray:
    """The most-activated `top_frac` of the frame becomes the attended region.

    top_frac is set per slice to the ventricle mask own area, so the two regions
    being compared are the SAME SIZE. Otherwise Dice mostly measures area
    mismatch: a fixed 15 percent attention region against a 3 percent ventricle
    mask caps Dice at 2*0.03/0.18 = 0.33 however perfectly they align. Equal
    areas make Dice a clean test of WHERE, not HOW MUCH.
    """
    thr = np.quantile(cam, 1 - float(np.clip(top_frac, 0.005, 0.9)))
    return cam >= thr


def centred_blob(size: int, area_frac: float) -> np.ndarray:
    """Null control: a centred disc of the same area as the CAM region.

    If the CAM's Dice against ventricles is no better than this, the model's
    'attention' carries no anatomical information -- it is just looking
    middle-ish, like everything else in a centred brain image.
    """
    r = int(np.sqrt(area_frac * size * size / np.pi))
    yy, xx = np.mgrid[:size, :size]
    return (yy - size / 2) ** 2 + (xx - size / 2) ** 2 <= r ** 2


def run(ckpt: Path, n_samples: int, size: int, top_frac: float, out_json: Path) -> dict:
    from .data.preprocess import unpack_masks

    mf = pd.read_csv(REPO / "cache" / "manifest.csv")
    splits = pd.read_csv(REPO / "cache" / "splits.csv")
    images = np.load(REPO / "cache" / f"slices_{size}.npy", mmap_mode="r")
    masks = np.load(REPO / "cache" / f"masks_{size}_packed.npy", mmap_mode="r")

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    state = torch.load(ckpt, map_location=device)
    model = build_model(state["arch"], 4, pretrained=False).to(device)
    model.load_state_dict(state["model"])
    train_size = int(state.get("args", {}).get("train_size") or size)
    print(f"checkpoint trained at {train_size}px; cache is {size}px")

    # Untrained control: same architecture, random weights.
    control = build_model(state["arch"], 4, pretrained=False).to(device).eval()

    # Sample held-out, mid-brain slices where ventricles are actually in-plane.
    held = splits["holdout"] == "test"
    mid = (mf["slice_idx"] > 120) & (mf["slice_idx"] < 145)
    pool = np.where(held.to_numpy() & mid.to_numpy())[0]
    rng = np.random.default_rng(0)
    sel = rng.choice(pool, size=min(n_samples, len(pool)), replace=False)

    rows = []
    for row in sel:
        img = np.asarray(images[row], dtype=np.uint8)
        head = unpack_masks(np.asarray(masks[row]), size)
        vent = ventricle_mask(img, head)
        if vent.sum() < 50:
            continue

        x = model_input(img, train_size, device)
        label = int(mf["label"].iloc[row])

        with torch.no_grad():
            pred = int(model(x).argmax(1).item())
        # Match every region area to the ventricle mask so the three Dice scores
        # below differ only in WHERE they place that area.
        area = float(vent.mean())
        cam = compute_cam(model, x, pred, size)[0]  # upsampled to cache resolution
        cam_bin = binarise_cam(cam, area)

        ctrl_cam = compute_cam(control, x, pred, size)[0]
        ctrl_bin = binarise_cam(ctrl_cam, area)
        blob = centred_blob(size, area)

        rows.append({
            "row": int(row), "subject": mf["subject"].iloc[row], "label": label, "pred": pred,
            "cam_dice": dice_score(cam_bin, vent), "cam_iou": iou_score(cam_bin, vent),
            "untrained_dice": dice_score(ctrl_bin, vent), "untrained_iou": iou_score(ctrl_bin, vent),
            "blob_dice": dice_score(blob, vent), "blob_iou": iou_score(blob, vent),
            "ventricle_area_frac": float(vent.mean()),
        })

    df = pd.DataFrame(rows)
    summary = {
        "n_slices": len(df),
        "region_area": "matched per slice to the ventricle mask",
        "mean_ventricle_area_frac": float(df.ventricle_area_frac.mean()),
        "cam_resolution_note": 'CAM is computed at the backbone final feature resolution (5x5 for a 160px input) then bilinearly upsampled, so it is inherently coarse. That bounds how high Dice can go regardless of alignment.',
        "trained_model": {"dice": float(df.cam_dice.mean()), "iou": float(df.cam_iou.mean())},
        "control_untrained_cnn": {"dice": float(df.untrained_dice.mean()),
                                  "iou": float(df.untrained_iou.mean())},
        "control_centred_blob": {"dice": float(df.blob_dice.mean()),
                                 "iou": float(df.blob_iou.mean())},
        "by_true_class": {
            SHORT_NAMES[c]: {"n": int((df.label == c).sum()),
                             "dice": float(df[df.label == c].cam_dice.mean())}
            for c in sorted(df.label.unique())
        },
    }
    t, u, b = (summary["trained_model"]["dice"],
               summary["control_untrained_cnn"]["dice"],
               summary["control_centred_blob"]["dice"])
    summary["verdict"] = (
        "Trained CAM overlaps ventricles more than both controls -- the model's attention "
        "is anatomically informed." if t > u and t > b else
        "Trained CAM does NOT beat the controls -- its apparent focus on the ventricles is "
        "explained by centre bias, not learned anatomy."
    )
    out_json.parent.mkdir(parents=True, exist_ok=True)
    jsonio.write(out_json, summary)
    df.to_csv(out_json.with_suffix(".csv"), index=False)
    return summary


def render_figure(ckpt: Path, size: int, out_png: Path, seed: int = 0) -> None:
    """One row per stage: slice, ventricle mask, area-matched CAM, and overlap.

    This is the figure that makes the Dice number interpretable -- it shows both
    that the ventricle mask is a real anatomical structure and that the attention
    region it is compared against has the same area.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    from .data.preprocess import unpack_masks

    mf = pd.read_csv(REPO / "cache" / "manifest.csv")
    sp = pd.read_csv(REPO / "cache" / "splits.csv")
    imgs = np.load(REPO / "cache" / f"slices_{size}.npy", mmap_mode="r")
    msks = np.load(REPO / "cache" / f"masks_{size}_packed.npy", mmap_mode="r")

    device = torch.device("cpu")
    state = torch.load(ckpt, map_location=device)
    model = build_model(state["arch"], 4, pretrained=False)
    model.load_state_dict(state["model"])
    model.eval()
    train_size = int(state.get("args", {}).get("train_size") or size)

    held = (sp["holdout"] == "test").to_numpy()
    mid = ((mf.slice_idx > 125) & (mf.slice_idx < 140)).to_numpy()
    rows = []
    for c in range(4):
        pool = np.where(held & mid & (mf.label.to_numpy() == c))[0]
        if len(pool):
            rows.append(int(np.random.default_rng(seed + c).choice(pool)))

    fig, ax = plt.subplots(len(rows), 4, figsize=(11, 2.8 * len(rows)))
    ax = np.atleast_2d(ax)
    for r, row in enumerate(rows):
        img = np.asarray(imgs[row], dtype=np.uint8)
        vent = ventricle_mask(img, unpack_masks(np.asarray(msks[row]), size))
        area = float(vent.mean())
        x = model_input(img, train_size, device)
        with torch.no_grad():
            pred = int(model(x).argmax(1))
        cam = compute_cam(model, x, pred, size)[0]
        cb = binarise_cam(cam, area)
        ov = np.zeros((size, size, 3))
        ov[..., 0] = cb
        ov[..., 1] = vent
        panels = [
            (img, f"{mf.class_name.iloc[row]}", "gray"),
            (vent, f"ventricle mask — {area * 100:.1f}% of frame", "gray"),
            (cb, f"attention, top {area * 100:.1f}% (area-matched)", "gray"),
            (ov, f"overlap — Dice {dice_score(cb, vent):.2f}", None),
        ]
        for c, (im, t, cm) in enumerate(panels):
            ax[r, c].imshow(im, cmap=cm)
            ax[r, c].set_title(t, fontsize=8)
            ax[r, c].axis("off")

    fig.suptitle("Is the model looking at the ventricles?   "
                 "red = attention, green = ventricles, yellow = overlap", fontsize=10)
    fig.tight_layout()
    out_png.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_png, dpi=110, bbox_inches="tight")
    plt.close(fig)
    print(f"Wrote {out_png}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--n", type=int, default=400)
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--top-frac", type=float, default=0.15)
    ap.add_argument("--out", default=str(REPO / "reports" / "cam_ventricle_overlap.json"))
    ap.add_argument("--figure", default=str(REPO / "reports" / "figures" / "cam_ventricles.png"))
    a = ap.parse_args()
    s = run(Path(a.ckpt), a.n, a.size, a.top_frac, Path(a.out))
    print(jsonio.dumps(s, indent=2))
    render_figure(Path(a.ckpt), a.size, Path(a.figure))
