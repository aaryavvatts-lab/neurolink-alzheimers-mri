"""Export whole scans as small volumes so the website can slice through them.

Each OASIS scan is 61 axial slices stacked up through the head. Stacked in
order that is a small 3D block, which means the other two viewing planes can be
rebuilt from it: cut the block front to back for a coronal view, side to side
for a sagittal one. Radiologists do this all the time and call it multiplanar
reconstruction. It costs nothing here because the data is already a volume, it
was just being treated as 61 unrelated pictures.

Each volume ships as one PNG holding every slice in a grid, which the browser
can decode in a single request, plus the model's answer for every slice so the
site can show how the prediction changes as you move up through the head.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
import torch

from . import jsonio
from .constants import SHORT_NAMES
from .data.dataset import MEAN, STD
from .models.transfer import build_model

REPO = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--size", type=int, default=224, help="cache resolution")
    ap.add_argument("--out-size", type=int, default=128, help="resolution shipped to the browser")
    ap.add_argument("--per-class", type=int, default=2)
    ap.add_argument("--out-dir", default=str(REPO / "web" / "public" / "volumes"))
    a = ap.parse_args()

    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    mf = pd.read_csv(REPO / "cache" / "manifest.csv")
    splits = pd.read_csv(REPO / "cache" / "splits.csv")
    images = np.load(REPO / "cache" / f"slices_{a.size}.npy", mmap_mode="r")

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    state = torch.load(a.ckpt, map_location=device)
    model = build_model(state["arch"], 4, pretrained=False).to(device).eval()
    model.load_state_dict(state["model"])
    train_size = int(state.get("args", {}).get("train_size") or a.size)

    held = (splits["holdout"] == "test").to_numpy()
    entries = []

    for cls in range(4):
        # Prefer held-out patients. Moderate has one, so this simply yields one.
        subs = pd.unique(mf["subject"].to_numpy()[held & (mf.label.to_numpy() == cls)])
        for subject in subs[: a.per_class]:
            rows = mf[(mf.subject == subject)]
            # One scan only, so the stack is a single continuous run through the head.
            scan = rows["scan"].iloc[0]
            rows = rows[rows.scan == scan].sort_values("slice_idx")
            idx = rows.index.to_numpy()
            if len(idx) < 20:
                continue

            vol = np.stack([
                cv2.resize(np.asarray(images[i], dtype=np.uint8),
                           (a.out_size, a.out_size), interpolation=cv2.INTER_AREA)
                for i in idx
            ])  # (D, H, W)

            # Score every slice so the site can plot the answer through the head.
            probs = []
            with torch.no_grad():
                for s in range(0, len(idx), 32):
                    chunk = np.stack([np.asarray(images[i], dtype=np.float32) / 255.0
                                      for i in idx[s:s + 32]])
                    t = torch.from_numpy(chunk)[:, None].to(device)
                    if train_size != a.size:
                        t = torch.nn.functional.interpolate(
                            t, size=(train_size, train_size), mode="bilinear", align_corners=False)
                    t = t.sub_(MEAN).div_(STD).expand(-1, 3, -1, -1)
                    probs.append(torch.softmax(model(t).float(), 1).cpu().numpy())
            probs = np.concatenate(probs)

            # Lay the stack out as one grid image: one request, one decode.
            cols = math.ceil(math.sqrt(len(vol)))
            rows_n = math.ceil(len(vol) / cols)
            sheet = np.zeros((rows_n * a.out_size, cols * a.out_size), np.uint8)
            for k, sl in enumerate(vol):
                r, c = divmod(k, cols)
                sheet[r * a.out_size:(r + 1) * a.out_size,
                      c * a.out_size:(c + 1) * a.out_size] = sl
            name = f"{SHORT_NAMES[cls].replace(' ', '')}_{subject}"
            cv2.imwrite(str(out / f"{name}.png"), sheet)

            entries.append({
                "id": name,
                "subject": str(subject),
                "scan": str(scan),
                "label": cls,
                "label_name": SHORT_NAMES[cls],
                "depth": int(len(vol)),
                "size": a.out_size,
                "cols": cols,
                "rows": rows_n,
                "slice_start": int(rows["slice_idx"].min()),
                "slice_end": int(rows["slice_idx"].max()),
                "sheet": f"volumes/{name}.png",
                "per_slice_probs": [[round(float(v), 4) for v in p] for p in probs],
                "mean_probs": [round(float(v), 4) for v in probs.mean(0)],
                "volume_pred": int(probs.mean(0).argmax()),
            })
            print(f"  {name}: {len(vol)} slices, scan {scan}, "
                  f"model says {SHORT_NAMES[int(probs.mean(0).argmax())]}")

    jsonio.write(out / "index.json", entries)
    print(f"Exported {len(entries)} volumes to {out}")


if __name__ == "__main__":
    main()
