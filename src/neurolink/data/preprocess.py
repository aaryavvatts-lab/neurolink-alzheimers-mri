"""Preprocess raw OASIS JPGs into a single uint8 memmap.

What "regularize the images" actually means for this dataset:

1. RGB -> grayscale. The JPGs are stored 3-channel but the channels are
   identical; MRI is single-channel intensity data.
2. Un-squash. Files are 496x248 -- the true 248x248 axial slice stretched 2x
   horizontally. Resizing to square restores real anatomical proportions.
   Skipping this feeds the CNN systematically distorted brains.
3. Crop to the head's bounding box (square, with margin). This is the reel's
   "centering the pixels", done properly: it removes variation in head position
   and field-of-view padding so the network sees anatomy, not framing.
4. Intensity normalise using percentiles computed INSIDE the head mask. Taking
   percentiles over the whole frame would just measure how much black
   background there is.
5. Resize to 224x224 and store uint8.

The result is one contiguous memmap, so training epochs page in raw bytes
instead of decoding 86k JPEGs each time -- the difference between a feasible
overnight cross-validation and an infeasible one.
"""

from __future__ import annotations

import argparse
import multiprocessing as mp
import os
import shutil
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from tqdm import tqdm


def to_grayscale(img: np.ndarray) -> np.ndarray:
    if img.ndim == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img


def head_mask(gray: np.ndarray) -> np.ndarray:
    """Filled binary mask of the head.

    NOT Otsu. The background in these scans is exactly zero (all four corners
    measure 0.0), so the head/background boundary is trivial -- but Otsu instead
    picks a threshold that splits *tissue* (~50 on a 0-255 range). On a dim scan
    like OAS1_0287, whose median head intensity is 21, that threshold cuts
    through the brain itself, fragments the head into pieces, and the
    largest-component step then keeps only the brightest fragment. The bounding
    box lands mid-skull and the intensity normalisation, computed over that
    sliver, blows the image out.

    A low absolute threshold scaled to the image's own dynamic range separates
    head from a zero background robustly at any brightness. Holes are then filled
    so that dark interior structures -- the ventricles, which are the very thing
    we care about -- cannot punch the mask apart.
    """
    thr = max(8.0, 0.10 * float(np.percentile(gray, 99)))
    binm = (cv2.GaussianBlur(gray, (5, 5), 0) > thr).astype(np.uint8)
    binm = cv2.morphologyEx(binm, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))

    n, labels, stats, _ = cv2.connectedComponentsWithStats(binm, connectivity=8)
    if n <= 1:
        return np.ones_like(gray, dtype=bool)
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    comp = (labels == largest).astype(np.uint8)

    # Fill interior holes: keep only outer contours and flood their interiors.
    contours, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(comp)
    cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)
    return filled.astype(bool)


def square_bbox(mask: np.ndarray, margin: float, shape: tuple[int, int]) -> tuple[int, int, int, int]:
    """Square bounding box around the mask, clamped to the image.

    Square matters: a non-square crop resized to 224x224 would re-introduce
    exactly the anisotropic distortion step 2 just removed.
    """
    ys, xs = np.where(mask)
    if len(ys) == 0:
        h, w = shape
        return 0, 0, w, h
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1

    cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
    side = max(y1 - y0, x1 - x0) * (1 + 2 * margin)
    half = side / 2

    H, W = shape
    y0 = max(0, int(round(cy - half)));  y1 = min(H, int(round(cy + half)))
    x0 = max(0, int(round(cx - half)));  x1 = min(W, int(round(cx + half)))
    return x0, y0, x1, y1


def normalise(gray: np.ndarray, mask: np.ndarray, lo_p: float, hi_p: float) -> np.ndarray:
    """Percentile clip + rescale to [0, 255], using head pixels only."""
    vals = gray[mask] if mask.any() else gray.ravel()
    lo, hi = np.percentile(vals, [lo_p, hi_p])
    if hi <= lo:
        lo, hi = float(gray.min()), float(max(gray.max(), gray.min() + 1))
    out = (gray.astype(np.float32) - lo) / (hi - lo)
    return np.clip(out, 0, 1)


def process_one(
    path: Path, size: int, margin: float, clip: tuple[float, float]
) -> tuple[np.ndarray, np.ndarray] | None:
    """Returns (processed uint8 image, head mask at output resolution)."""
    raw = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if raw is None:
        return None
    gray = to_grayscale(raw)

    # Un-squash: 496x248 -> square, restoring true proportions.
    side = max(gray.shape)
    if gray.shape[0] != gray.shape[1]:
        gray = cv2.resize(gray, (side, side), interpolation=cv2.INTER_CUBIC)

    mask = head_mask(gray)
    x0, y0, x1, y1 = square_bbox(mask, margin, gray.shape)
    gray_c, mask_c = gray[y0:y1, x0:x1], mask[y0:y1, x0:x1]

    norm = normalise(gray_c, mask_c, *clip)
    out = cv2.resize(norm, (size, size), interpolation=cv2.INTER_AREA)
    out_mask = cv2.resize(mask_c.astype(np.uint8), (size, size), interpolation=cv2.INTER_NEAREST)
    return (out * 255).astype(np.uint8), out_mask.astype(bool)



def _worker(task: tuple[int, str, int, float, tuple[float, float]]):
    """Module-level so it is picklable by multiprocessing."""
    i, rel, size, margin, clip = task
    res = process_one(_WORKER_ROOT / rel, size, margin, clip)
    if res is None:
        return i, None, None
    return i, res[0], np.packbits(res[1].ravel())


_WORKER_ROOT: Path = Path(".")


def _init_worker(root: str) -> None:
    global _WORKER_ROOT
    _WORKER_ROOT = Path(root)
    cv2.setNumThreads(1)  # each worker is already a process; avoid thread thrash


def unpack_masks(packed: np.ndarray, size: int) -> np.ndarray:
    """Inverse of the bit-packing used by build_cache."""
    flat = np.unpackbits(packed, axis=-1, count=size * size)
    return flat.reshape(*packed.shape[:-1], size, size).astype(bool)


def build_cache(repo: Path, size: int, margin: float, clip: tuple[float, float]) -> None:
    manifest = pd.read_csv(repo / "cache" / "manifest.csv")
    n = len(manifest)

    # Head masks are stored BIT-PACKED. At uint8 they would cost as much as the
    # images themselves (4.3 GB); packed they cost 0.54 GB. They are needed for
    # the whole dataset, not just a sample, because the shortcut probe trains on
    # brain-removed images.
    img_gb = n * size * size / 1e9
    msk_gb = n * (size * size // 8) / 1e9
    free_gb = shutil.disk_usage(repo).free / 1e9
    print(f"Cache plan: images {img_gb:.2f} GB + packed masks {msk_gb:.2f} GB "
          f"= {img_gb + msk_gb:.2f} GB;  free: {free_gb:.1f} GB")
    if free_gb < img_gb + msk_gb + 3.0:
        raise SystemExit(
            f"Refusing to start: only {free_gb:.1f} GB free, need "
            f"{img_gb + msk_gb + 3.0:.1f} GB including headroom. Re-run with a smaller --size."
        )

    assert size * size % 8 == 0, "size^2 must be divisible by 8 for bit packing"
    img_path = repo / "cache" / f"slices_{size}.npy"
    msk_path = repo / "cache" / f"masks_{size}_packed.npy"
    images = np.lib.format.open_memmap(img_path, mode="w+", dtype=np.uint8, shape=(n, size, size))
    masks = np.lib.format.open_memmap(
        msk_path, mode="w+", dtype=np.uint8, shape=(n, size * size // 8)
    )

    # Each image is independent, so this parallelises perfectly. Single-process
    # throughput is ~29 img/s (a 49-minute pass); a worker pool cuts that to a
    # few minutes on this machine.
    n_proc = max(1, min(os.cpu_count() or 4, 10))
    tasks = [(i, rel, size, margin, clip) for i, rel in enumerate(manifest["path"])]
    print(f"preprocessing with {n_proc} worker processes")

    failed = []
    with mp.Pool(n_proc, initializer=_init_worker, initargs=(str(repo / "data"),)) as pool:
        for i, img, packed in tqdm(
            pool.imap_unordered(_worker, tasks, chunksize=64),
            total=n, desc="preprocess", unit="img"
        ):
            if img is None:
                failed.append(manifest["path"].iloc[i])
                continue
            images[i] = img
            masks[i] = packed

    images.flush(); masks.flush()
    if failed:
        print(f"WARNING: {len(failed)} images failed to decode: {failed[:5]}")
        (repo / "cache" / "failed.txt").write_text("\n".join(failed))
    print(f"Wrote {img_path.name} ({img_gb:.2f} GB) and {msk_path.name} ({msk_gb:.2f} GB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--margin", type=float, default=0.04)
    ap.add_argument("--probe", type=int, default=0, help="render N sanity samples instead of building")
    args = ap.parse_args()

    repo = Path(__file__).resolve().parents[3]
    clip = (1.0, 99.0)

    if args.probe:
        from .probe import render_probe
        render_probe(repo, args.size, args.margin, clip, args.probe)
    else:
        build_cache(repo, args.size, args.margin, clip)
