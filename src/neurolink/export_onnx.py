"""Export the trained model to ONNX for in-browser inference.

Vercel is a static/serverless host: it cannot run PyTorch. Rather than stand up a
GPU inference server, the model ships to the visitor and runs in their browser via
onnxruntime-web. Nothing leaves the machine, there is no cold start, and there is
no per-request cost.

The exported graph returns BOTH the logits and all four class activation maps.
Computing the CAMs inside the graph -- as a 1x1 convolution with the classifier's
own weight matrix -- means the browser needs no gradients and no extra maths to
draw the attention overlay. This is why every model in models/ was built with a
global-average-pool head.

Parity against PyTorch is verified on real held-out slices before anything ships.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from .data.dataset import MEAN, STD
from .models.transfer import build_model
from . import jsonio

REPO = Path(__file__).resolve().parents[2]


class ExportWrapper(nn.Module):
    """logits + per-class CAMs in one forward pass."""

    def __init__(self, base: nn.Module):
        super().__init__()
        self.base = base.eval()
        # The CAM convolution gets its OWN (K, C, 1, 1) parameter rather than a
        # reshaped view of fc.weight. Slicing fc.weight inline makes the exported
        # graph alias one (K, C) initializer for two different shapes, and
        # onnxruntime's quantiser then fails shape inference with
        # "Inferred shape and existing shape differ in dimension 0: (512) vs (4)".
        self.cam_weight = nn.Parameter(
            base.fc.weight.detach().clone()[:, :, None, None], requires_grad=False)

    def forward(self, x: torch.Tensor):
        f = self.base.features(x)
        z = self.base.pool(f).flatten(1)
        logits = self.base.fc(z)                      # dropout is identity in eval
        cams = F.conv2d(f, self.cam_weight)           # (B, K, h, w)
        return logits, cams


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--out-dir", default=str(REPO / "web" / "public" / "model"))
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--n-parity", type=int, default=200)
    ap.add_argument("--quantize", action="store_true")
    a = ap.parse_args()

    out_dir = Path(a.out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    state = torch.load(a.ckpt, map_location="cpu")
    # Export at the resolution the model was TRAINED at, not the cache resolution.
    # The browser preprocessing reads input_size from model_meta.json, so this one
    # value keeps training, export and the live demo in agreement.
    cache_size = a.size                      # resolution of slices_*.npy on disk
    train_size = int(state.get("args", {}).get("train_size") or cache_size)
    if train_size != cache_size:
        print(f"cache is {cache_size}px; checkpoint trained at {train_size}px "
              f"-> exporting at {train_size}px")
    model = build_model(state["arch"], 4, pretrained=False)
    model.load_state_dict(state["model"])
    wrapper = ExportWrapper(model).eval()

    dummy = torch.randn(1, 3, train_size, train_size)
    fp32 = out_dir / "neurolink.onnx"
    # dynamo=False selects the legacy TorchScript exporter, deliberately.
    #
    # The default torch.export path emits the global-average-pool as
    # ReduceMean + Shape + Reshape + Concat. onnxruntime's dynamic quantiser
    # cannot shape-infer that graph -- it dies with "Inferred shape and existing
    # shape differ in dimension 0: (512) vs (4)" -- so the model could only ship
    # as 45 MB of fp32. The legacy exporter emits GlobalAveragePool + Flatten,
    # which quantises cleanly to 11 MB. That is a 4x smaller download for every
    # visitor, and parity against PyTorch is verified below either way.
    #
    # external_data=False keeps the weights INSIDE the .onnx file; the default
    # splits them into a sidecar the browser would have to fetch separately.
    torch.onnx.export(
        wrapper, (dummy,), str(fp32),
        input_names=["input"], output_names=["logits", "cams"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}, "cams": {0: "batch"}},
        opset_version=17, do_constant_folding=True, dynamo=False,
    )
    for stale in out_dir.glob("*.onnx.data"):
        stale.unlink()
    print(f"exported {fp32.name}  ({fp32.stat().st_size / 1e6:.1f} MB)")

    ship = fp32
    quantised_ok = False
    if a.quantize:
        # Quantisation is an optimisation, not a requirement. If it fails we ship
        # fp32 rather than shipping nothing -- but we say so, loudly.
        try:
            from onnxruntime.quantization import QuantType, quantize_dynamic
            q = out_dir / "neurolink.int8.onnx"
            quantize_dynamic(str(fp32), str(q), weight_type=QuantType.QUInt8)
            print(f"quantised {q.name}  ({q.stat().st_size / 1e6:.1f} MB)")
            ship = q
            quantised_ok = True
        except Exception as e:
            print(f"  int8 quantisation FAILED ({type(e).__name__}: {e}); shipping fp32")

    # ---- parity on REAL held-out slices, not random noise ----
    import onnxruntime as ort
    import pandas as pd

    mf = pd.read_csv(REPO / "cache" / "manifest.csv")
    splits = pd.read_csv(REPO / "cache" / "splits.csv")
    images = np.load(REPO / "cache" / f"slices_{cache_size}.npy", mmap_mode="r")
    pool = np.where((splits["holdout"] == "test").to_numpy())[0]
    sel = np.random.default_rng(0).choice(pool, size=min(a.n_parity, len(pool)), replace=False)

    batch = np.stack([np.asarray(images[r], dtype=np.float32) / 255.0 for r in sel])
    t = torch.from_numpy(batch)[:, None]
    if train_size != cache_size:
        t = torch.nn.functional.interpolate(
            t, size=(train_size, train_size), mode="bilinear", align_corners=False)
    t = (t - MEAN) / STD
    x = t.expand(-1, 3, -1, -1).numpy().astype(np.float32)

    with torch.no_grad():
        t_logits, t_cams = wrapper(torch.from_numpy(x))
    t_logits, t_cams = t_logits.numpy(), t_cams.numpy()

    report = {}
    for name, path in [("fp32", fp32)] + ([("int8", ship)] if quantised_ok else []):
        sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        o_logits, o_cams = sess.run(None, {"input": x})
        agree = float((o_logits.argmax(1) == t_logits.argmax(1)).mean())
        report[name] = {
            "max_abs_logit_diff": float(np.abs(o_logits - t_logits).max()),
            "mean_abs_logit_diff": float(np.abs(o_logits - t_logits).mean()),
            "argmax_agreement": agree,
            "cam_correlation": float(np.corrcoef(o_cams.ravel(), t_cams.ravel())[0, 1]),
            "size_mb": round(path.stat().st_size / 1e6, 2),
        }
        print(f"  {name}: argmax agreement {agree:.4f}, "
              f"max |dlogit| {report[name]['max_abs_logit_diff']:.5f}, "
              f"CAM corr {report[name]['cam_correlation']:.5f}")

    chosen = "int8" if (quantised_ok and report.get("int8", {}).get("argmax_agreement", 0) >= 0.99) else "fp32"
    if quantised_ok and chosen == "fp32":
        print("  int8 parity below 0.99 -> shipping fp32 instead")

    # Preprocessing constants travel WITH the model so the browser cannot drift
    # from the training pipeline.
    meta = {
        "arch": state["arch"],
        "input_size": train_size,
        "mean": MEAN, "std": STD,
        "classes": ["Non Demented", "Very mild Dementia", "Mild Dementia", "Moderate Dementia"],
        "cdr": [0.0, 0.5, 1.0, 2.0],
        "model_file": "neurolink.onnx" if chosen == "fp32" else "neurolink.int8.onnx",
        "preprocessing": {
            "note": "Must match src/neurolink/data/preprocess.py exactly.",
            "steps": ["grayscale", "resize to square (undo 2x horizontal stretch)",
                      "head bounding-box crop with 4% margin",
                      "percentile clip 1-99 inside head mask", f"resize to {cache_size}px then {train_size}px",
                      "scale to [0,1], subtract mean, divide by std, repeat to 3 channels"],
            "crop_margin": 0.04, "clip_percentiles": [1.0, 99.0],
        },
        "parity": report,
        "checkpoint": {"val_balanced_accuracy": state.get("val_balanced_accuracy"),
                       "epoch": state.get("epoch")},
    }
    jsonio.write(out_dir / "model_meta.json", meta)
    print(f"shipping {meta['model_file']} -> {out_dir}")


if __name__ == "__main__":
    main()
