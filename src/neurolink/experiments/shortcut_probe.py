"""Is the model reading anatomy, or a confound?

Retrains on images with the brain erased -- skull rim, scalp and background
survive, the parenchyma does not. There is no dementia information left in such
an image. If the model still scores well above chance, then something outside the
brain correlates with the label: head size, scanner settings, acquisition-era
artefacts, JPEG characteristics. That would mean the main results are measuring a
confound rather than atrophy.

Reported whichever way it comes out. A near-chance result is what licenses us to
believe the headline numbers; a high result would be the more interesting finding
and would invalidate them.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from .. import jsonio

REPO = Path(__file__).resolve().parents[3]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="resnet18")
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--slice-stride", type=int, default=3)
    a, extra = ap.parse_known_args()

    tag = "probe_brain_removed"
    cmd = [sys.executable, "-m", "src.neurolink.train",
           "--model", a.model, "--split-mode", "holdout", "--mask-mode", "brain_removed",
           "--epochs", str(a.epochs), "--slice-stride", str(a.slice_stride),
           "--tag", tag, *extra]
    print(f"$ {' '.join(cmd)}\n", flush=True)
    subprocess.run(cmd, cwd=REPO, check=True)

    from ..evaluate import evaluate_run, print_report
    e = evaluate_run(REPO / "runs" / tag)
    print_report(e)

    bal = e["subject_level"]["balanced_accuracy"]
    chance = 0.25
    verdict = (
        "PASS -- brain-removed images carry little label information, so the main "
        "results are unlikely to be driven by an extra-cerebral confound."
        if bal < chance + 0.15 else
        "FAIL -- the label is substantially predictable WITHOUT the brain. The main "
        "results are contaminated by a non-anatomical shortcut and must not be "
        "interpreted as diagnosis."
    )
    out = {
        "subject_level_balanced_accuracy": bal,
        "slice_level_balanced_accuracy": e["slice_level"]["balanced_accuracy"],
        "chance_level": chance,
        "verdict": verdict,
    }
    jsonio.write(REPO / "reports" / "shortcut_probe.json", out)
    print(f"\n{'=' * 72}\nSHORTCUT PROBE (brain removed)\n{'=' * 72}")
    print(f"  subject-level balanced accuracy: {bal:.4f}  (chance = {chance:.2f})")
    print(f"  {verdict}")


if __name__ == "__main__":
    main()
