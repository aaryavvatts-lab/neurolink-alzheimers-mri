"""Torch dataset over the preprocessed memmap, plus batched GPU augmentation.

Because preprocessing already removed JPEG decoding, __getitem__ is a bare
memmap read. That made per-sample CPU augmentation the entire bottleneck --
measured at 104 img/s, i.e. ~10 minutes per epoch of pure torchvision overhead.

So augmentation happens on the GPU instead, on whole batches, via a per-sample
affine grid. It is still independently random for every image in the batch (a
single shared transform per batch would weaken the regularisation), but it costs
one fused kernel rather than 96 separate CPU calls.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset

# Single-channel MRI stats after our normalisation, replicated to 3 channels so
# ImageNet-pretrained stems work. These constants are ALSO written into the web
# bundle so browser preprocessing cannot silently drift from training.
MEAN = 0.449
STD = 0.226


class SliceDataset(Dataset):
    """Serves raw preprocessed slices as uint8. Augmentation is applied later,
    on device, by `gpu_augment`.

    mask_mode controls the shortcut probe:
      None            -- the real image
      'brain_removed' -- head interior erased, leaving skull rim and background.
                         A model that still succeeds here is reading a confound.
      'brain_only'    -- everything outside the head erased.
    """

    def __init__(
        self,
        repo: Path,
        indices: np.ndarray,
        labels: np.ndarray,
        size: int = 224,
        train: bool = False,
        mask_mode: str | None = None,
    ):
        self.repo, self.size = Path(repo), size
        self.indices = np.asarray(indices)
        self.labels = np.asarray(labels)
        self.train = train
        self.mask_mode = mask_mode
        self._images = None
        self._masks = None
        self._erode_k = None

    def _lazy_open(self):
        """Memmaps are opened per-worker: an open handle cannot be forked safely."""
        if self._images is None:
            self._images = np.load(self.repo / "cache" / f"slices_{self.size}.npy", mmap_mode="r")
        if self._masks is None and self.mask_mode is not None:
            self._masks = np.load(
                self.repo / "cache" / f"masks_{self.size}_packed.npy", mmap_mode="r")

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, i: int):
        self._lazy_open()
        row = int(self.indices[i])
        img = np.array(self._images[row], dtype=np.uint8)  # copy: memmap is read-only

        if self.mask_mode is not None:
            import cv2
            m = np.unpackbits(np.asarray(self._masks[row]), count=self.size * self.size)
            m = m.reshape(self.size, self.size)
            if self.mask_mode == "brain_removed":
                # Erode inward so the skull rim survives but the brain does not.
                inner = cv2.erode(m, np.ones((15, 15), np.uint8), iterations=2)
                img = np.where(inner.astype(bool), 0, img).astype(np.uint8)
            elif self.mask_mode == "brain_only":
                img = np.where(m.astype(bool), img, 0).astype(np.uint8)

        return torch.from_numpy(img), int(self.labels[i]), row


def gpu_augment(x: torch.Tensor, generator: torch.Generator | None = None) -> torch.Tensor:
    """Per-sample random affine + horizontal flip + brightness/contrast, batched.

    x: (B, 1, H, W) float in [0, 1]. Returns the same shape.

    Rotation +/-10 deg, translation +/-5%, scale 0.95-1.05, horizontal flip p=0.5.
    No vertical flip: axial brain slices have a fixed anterior/posterior
    orientation, and flipping it would create anatomy that cannot occur.
    """
    B = x.shape[0]
    dev = x.device

    def rand(lo: float, hi: float) -> torch.Tensor:
        return torch.rand(B, device=dev) * (hi - lo) + lo

    ang = rand(-10, 10) * torch.pi / 180
    scale = rand(0.95, 1.05)
    tx, ty = rand(-0.05, 0.05), rand(-0.05, 0.05)
    flip = torch.where(torch.rand(B, device=dev) < 0.5, -1.0, 1.0)

    cos, sin = torch.cos(ang) / scale, torch.sin(ang) / scale
    theta = torch.zeros(B, 2, 3, device=dev, dtype=x.dtype)
    theta[:, 0, 0] = cos * flip
    theta[:, 0, 1] = -sin
    theta[:, 0, 2] = tx
    theta[:, 1, 0] = sin * flip
    theta[:, 1, 1] = cos
    theta[:, 1, 2] = ty

    grid = F.affine_grid(theta, list(x.shape), align_corners=False)
    x = F.grid_sample(x, grid, mode="bilinear", padding_mode="zeros", align_corners=False)

    # Brightness and contrast, per sample, about each image's own mean.
    b = rand(-0.15, 0.15).view(B, 1, 1, 1)
    c = rand(0.85, 1.15).view(B, 1, 1, 1)
    m = x.mean(dim=(1, 2, 3), keepdim=True)
    return ((x - m) * c + m + b).clamp_(0, 1)


def to_model_input(
    x_uint8: torch.Tensor, train: bool, device: torch.device, size: int | None = None
) -> torch.Tensor:
    """(B, H, W) uint8 -> (B, 3, size, size) normalised float on `device`.

    `size` downsamples on the GPU from the cached 224px. Convolution cost scales
    with area, so 176px runs ~1.6x faster than 224px for the same architecture.
    The structures that matter here -- ventricles, cortical bulk -- are large,
    so the resolution cut is cheap. Resampling on device costs one kernel and
    avoids maintaining a second cache on a nearly full disk.
    """
    x = x_uint8.to(device, non_blocking=True).unsqueeze(1).float().div_(255.0)
    if size is not None and size != x.shape[-1]:
        x = F.interpolate(x, size=(size, size), mode="bilinear", align_corners=False)
    if train:
        x = gpu_augment(x)
    x = x.sub_(MEAN).div_(STD)
    return x.expand(-1, 3, -1, -1)
