"""Aggregate every run into one results.json (consumed by the website) + figures.

Nothing here recomputes a model. It reads what the runs actually produced, so the
site can never show a number that was not measured.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

from . import figures
from .constants import CLASS_NAMES, SHORT_NAMES
from .evaluate import evaluate_run
from . import jsonio

REPO = Path(__file__).resolve().parents[2]


def load_json(p: Path):
    return json.loads(p.read_text()) if p.exists() else None


def dataset_block(mf: pd.DataFrame) -> dict:
    g = mf.groupby("class_name").agg(images=("path", "size"), subjects=("subject", "nunique"),
                                     cdr=("cdr", "first")).sort_values("cdr")
    return {
        "total_images": int(len(mf)),
        "total_subjects": int(mf["subject"].nunique()),
        "slices_per_subject_median": int(mf.groupby("subject").size().median()),
        "slice_index_range": [int(mf.slice_idx.min()), int(mf.slice_idx.max())],
        "raw_resolution": "496x248",
        "classes": [
            {"name": n, "short": SHORT_NAMES[CLASS_NAMES.index(n)], "cdr": float(r.cdr),
             "images": int(r.images), "subjects": int(r.subjects),
             "images_pct": round(100 * r.images / len(mf), 1)}
            for n, r in g.iterrows()
        ],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="*", default=[])
    ap.add_argument("--stage", default="A")
    a = ap.parse_args()

    figures.FIG.mkdir(parents=True, exist_ok=True)
    mf = pd.read_csv(REPO / "cache" / "manifest.csv")

    results = {"stage": a.stage, "dataset": dataset_block(mf), "runs": {}}
    figures.dataset_overview(mf, figures.FIG / "dataset_overview.png")

    # ---- individual runs ----
    run_dirs = [REPO / "runs" / r for r in a.runs] if a.runs else sorted(
        p for p in (REPO / "runs").iterdir() if (p / "summary.json").exists())

    for rd in run_dirs:
        try:
            e = evaluate_run(rd)
        except FileNotFoundError:
            continue
        results["runs"][rd.name] = {
            k: e[k] for k in ("model", "split_mode", "fold", "mask_mode", "leaking_split",
                              "minutes", "best_epoch", "n_train_subjects", "n_test_subjects",
                              "slice_level", "subject_level", "calibration",
                              "abstention_subject", "subject_predictions")
        }
        figures.confusion(np.array(e["subject_level"]["confusion_matrix"]),
                          f"{rd.name}, subject level", figures.FIG / f"cm_subject_{rd.name}.png")
        figures.confusion(np.array(e["slice_level"]["confusion_matrix"]),
                          f"{rd.name}, slice level", figures.FIG / f"cm_slice_{rd.name}.png")

    # ---- leakage experiment ----
    lk = load_json(REPO / "reports" / "leakage_experiment.json")
    if lk:
        results["leakage_experiment"] = lk
        figures.leakage_bar(lk, figures.FIG / "leakage.png")

    # ---- probes and baselines ----
    for key, fname in [("shortcut_probe", "shortcut_probe.json"),
                       ("cam_ventricle_overlap", "cam_ventricle_overlap.json"),
                       ("ventricle_baseline", "baseline_ventricle_lr.json")]:
        v = load_json(REPO / "reports" / fname)
        if v:
            results[key] = v

    # ---- pooled cross-validation, if Stage B has run ----
    for cvf in sorted((REPO / "reports").glob("crossval_*.json")):
        results["crossval"] = json.loads(cvf.read_text())
        print(f"  included {cvf.name}")

    # ---- primary model: best honest subject-split run ----
    honest = {k: v for k, v in results["runs"].items()
              if not v["leaking_split"] and v["mask_mode"] is None}
    if honest:
        primary = max(honest, key=lambda k: honest[k]["subject_level"]["balanced_accuracy"])
        results["primary_run"] = primary
        p = results["runs"][primary]
        figures.abstention(p["abstention_subject"], figures.FIG / "abstention.png")
        d = np.load(REPO / "runs" / primary / "test_predictions.npz", allow_pickle=True)
        figures.reliability(d["probs"], d["y_true"], figures.FIG / "reliability.png")

    out = REPO / "reports" / "results.json"
    jsonio.write(out, results)

    web = REPO / "web" / "public"
    if web.exists():
        shutil.copy(out, web / "results.json")
        (web / "figures").mkdir(exist_ok=True)
        for f in figures.FIG.glob("*.png"):
            shutil.copy(f, web / "figures" / f.name)

    print(f"Wrote {out}  ({len(results['runs'])} runs)")
    if honest:
        print(f"Primary run: {results['primary_run']}")
    for name, r in results["runs"].items():
        flag = "  [LEAKY]" if r["leaking_split"] else ""
        print(f"  {name:36s} subj-bal-acc {r['subject_level']['balanced_accuracy']:.4f}{flag}")


if __name__ == "__main__":
    main()
