"""Export held-out sample slices for the website gallery.

Every sample comes from a subject the model never saw in training. The gallery
doubles as a fallback: if onnxruntime-web fails on a visitor's browser, the
precomputed predictions still render.

Both the RAW jpg and the preprocessed 224px png are shipped, so the site can
demonstrate the preprocessing pipeline and so the in-browser path can be tested
against the raw input a user would actually upload.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
import torch

from .constants import SHORT_NAMES
from .data.dataset import MEAN, STD
from .models.transfer import build_model

REPO = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--per-class", type=int, default=6)
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--out-dir", default=str(REPO / "web" / "public" / "samples"))
    a = ap.parse_args()

    out = Path(a.out_dir); (out / "raw").mkdir(parents=True, exist_ok=True)
    (out / "pre").mkdir(parents=True, exist_ok=True)

    mf = pd.read_csv(REPO / "cache" / "manifest.csv")
    splits = pd.read_csv(REPO / "cache" / "splits.csv")
    images = np.load(REPO / "cache" / f"slices_{a.size}.npy", mmap_mode="r")

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    state = torch.load(a.ckpt, map_location=device)
    model = build_model(state["arch"], 4, pretrained=False).to(device).eval()
    model.load_state_dict(state["model"])
    train_size = int(state.get("args", {}).get("train_size") or a.size)
    print(f"scoring samples at {train_size}px (the resolution the model was trained at)")

    held = (splits["holdout"] == "test").to_numpy()
    mid = ((mf.slice_idx > 122) & (mf.slice_idx < 142)).to_numpy()
    rng = np.random.default_rng(11)

    entries = []
    for cls in range(4):
        pool = np.where(held & mid & (mf.label.to_numpy() == cls))[0]
        if len(pool) == 0:
            print(f"  class {SHORT_NAMES[cls]}: no held-out mid-brain slices")
            continue
        # One slice per distinct subject where possible -- a gallery of six cuts
        # from one brain would misrepresent the diversity of the test set.
        subs = mf["subject"].to_numpy()[pool]
        chosen = []
        for s in pd.unique(subs)[: a.per_class]:
            cand = pool[subs == s]
            chosen.append(int(rng.choice(cand)))
        while len(chosen) < a.per_class and len(pool) > len(chosen):
            extra = int(rng.choice(pool))
            if extra not in chosen:
                chosen.append(extra)

        for row in chosen:
            rec = mf.iloc[row]
            stem = f"{SHORT_NAMES[cls].replace(' ', '')}_{rec.subject}_{rec.slice_idx}"
            shutil.copy(REPO / "data" / rec["path"], out / "raw" / f"{stem}.jpg")
            img = np.asarray(images[row], dtype=np.uint8)
            cv2.imwrite(str(out / "pre" / f"{stem}.png"), img)

            x = torch.from_numpy(img)[None].to(device).unsqueeze(1).float().div(255)
            if train_size != a.size:
                x = torch.nn.functional.interpolate(
                    x, size=(train_size, train_size), mode="bilinear", align_corners=False)
            x = x.sub_(MEAN).div_(STD).expand(-1, 3, -1, -1)
            with torch.no_grad():
                probs = torch.softmax(model(x).float(), 1)[0].cpu().numpy()

            entries.append({
                "id": stem, "subject": str(rec.subject), "slice": int(rec.slice_idx),
                "true_label": cls, "true_name": SHORT_NAMES[cls],
                "raw": f"samples/raw/{stem}.jpg", "pre": f"samples/pre/{stem}.png",
                "pytorch_probs": [round(float(v), 4) for v in probs],
                "pytorch_pred": int(probs.argmax()),
            })

    (out / "index.json").write_text(json.dumps(entries, indent=2))
    n_correct = sum(e["pytorch_pred"] == e["true_label"] for e in entries)
    print(f"Exported {len(entries)} held-out samples "
          f"({n_correct}/{len(entries)} correctly predicted) -> {out}")


if __name__ == "__main__":
    main()
