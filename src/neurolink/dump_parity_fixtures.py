"""Dump fixtures for the browser/Python preprocessing parity test.

The live demo reimplements preprocess.py in TypeScript so the model can run in
the visitor's browser. Two implementations of the same pipeline drift silently:
nothing throws, the image still looks like a brain, and the predictions are
quietly wrong. web/test/preprocess.parity.ts guards against that, and this
script produces what it compares against.

For each sample it writes:
  <id>.rgba   raw RGBA bytes of the ORIGINAL jpg, so the TypeScript side needs
              no image decoder and no canvas
  cases.json  image dimensions plus the exact normalised tensor Python derives

Run:  python -m src.neurolink.dump_parity_fixtures
Then: cd web && npm test
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import torch

from .data.dataset import MEAN, STD
from .data.preprocess import process_one

REPO = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=6)
    ap.add_argument("--cache-size", type=int, default=224)
    ap.add_argument("--input-size", type=int, default=None,
                    help="model input size; defaults to the value in model_meta.json")
    a = ap.parse_args()

    web = REPO / "web" / "public"
    samples = json.loads((web / "samples" / "index.json").read_text())[: a.n]

    input_size = a.input_size
    if input_size is None:
        meta_p = web / "model" / "model_meta.json"
        input_size = json.loads(meta_p.read_text())["input_size"] if meta_p.exists() else 160

    out = REPO / "web" / "test" / "fixtures"
    out.mkdir(parents=True, exist_ok=True)

    cases = []
    for s in samples:
        raw_path = web / s["raw"]
        bgr = cv2.imread(str(raw_path), cv2.IMREAD_COLOR)
        h, w = bgr.shape[:2]
        rgba = np.dstack([bgr[..., ::-1], np.full((h, w, 1), 255, np.uint8)])
        (out / f"{s['id']}.rgba").write_bytes(rgba.tobytes())

        # Exactly what training saw: the cached image, then the GPU downsample.
        cached, _ = process_one(raw_path, a.cache_size, 0.04, (1.0, 99.0))
        t = torch.from_numpy(cached)[None, None].float().div(255)
        if input_size != a.cache_size:
            t = torch.nn.functional.interpolate(
                t, size=(input_size, input_size), mode="bilinear", align_corners=False)
        t = (t - MEAN) / STD
        cases.append({
            "id": s["id"], "width": int(w), "height": int(h),
            "input_size": int(input_size),
            "tensor160": [round(float(v), 5) for v in t.ravel().tolist()],
        })

    (out / "cases.json").write_text(json.dumps(cases))
    print(f"Wrote {len(cases)} fixtures ({input_size}px) -> {out}")
    print("Now run:  cd web && npm test")


if __name__ == "__main__":
    main()
