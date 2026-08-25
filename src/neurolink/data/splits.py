"""Subject-grouped cross-validation splits.

This module is the whole point of the project.

With 86,437 slices drawn from 347 people, a random split is not a test of
diagnosis -- it is a test of memory. Slice 119 and slice 120 of one brain are
near-identical images; put one in train and the other in test and the model can
score near-perfectly by recognising the person, never having learned anything
about dementia. Published OASIS accuracies of "99%" are very often this artefact.

Every split produced here groups on `subject`, so a person appears on exactly one
side of the boundary. `assert_no_subject_leakage` is called at the top of every
training run and raises rather than warns.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold


def make_folds(manifest: pd.DataFrame, n_folds: int = 5, seed: int = 1337) -> np.ndarray:
    """Assign every row a fold index, grouped by subject and stratified by class.

    Stratification is best-effort: Moderate Dementia has only two subjects, so
    three of the five folds necessarily contain zero Moderate test subjects.
    That is a property of the dataset, not a bug -- see `fold_report`.
    """
    sgkf = StratifiedGroupKFold(n_splits=n_folds, shuffle=True, random_state=seed)
    folds = np.full(len(manifest), -1, dtype=int)
    for k, (_, test_idx) in enumerate(
        sgkf.split(manifest, manifest["label"], groups=manifest["subject"])
    ):
        folds[test_idx] = k
    assert (folds >= 0).all(), "every row must be assigned to exactly one fold"
    return folds


def subject_holdout(
    manifest: pd.DataFrame, val_frac: float = 0.15, test_frac: float = 0.15, seed: int = 1337
) -> np.ndarray:
    """Single train/val/test split by subject, stratified by class.

    Used for Stage A (fast pipeline validation) before committing to full CV.
    Returns an array of 'train'/'val'/'test' strings.
    """
    rng = np.random.default_rng(seed)
    subj = manifest.groupby("subject")["label"].first()
    assign = {}
    for label in sorted(subj.unique()):
        members = subj[subj == label].index.to_numpy()
        rng.shuffle(members)
        n = len(members)
        # Guarantee at least one subject per split where the class allows it.
        n_test = max(1, int(round(n * test_frac))) if n >= 3 else (1 if n >= 2 else 0)
        n_val = max(1, int(round(n * val_frac))) if n >= 3 else 0
        for s in members[:n_test]:
            assign[s] = "test"
        for s in members[n_test:n_test + n_val]:
            assign[s] = "val"
        for s in members[n_test + n_val:]:
            assign[s] = "train"
    return manifest["subject"].map(assign).to_numpy()


def random_slice_split(
    manifest: pd.DataFrame, val_frac: float = 0.15, test_frac: float = 0.15, seed: int = 1337
) -> np.ndarray:
    """THE WRONG WAY, implemented deliberately.

    Shuffles individual slices with no regard for subject. This is what the naive
    tutorial version of this project does. We build it only so we can train an
    otherwise-identical model on it and measure how large the resulting illusion
    is. Never use this for a reported result.
    """
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(manifest))
    n_test = int(len(idx) * test_frac)
    n_val = int(len(idx) * val_frac)
    out = np.array(["train"] * len(manifest), dtype=object)
    out[idx[:n_test]] = "test"
    out[idx[n_test:n_test + n_val]] = "val"
    return out


def assert_no_subject_leakage(manifest: pd.DataFrame, train_mask, test_mask, context: str = "") -> None:
    """Hard failure if any subject appears on both sides of the split."""
    tr = set(manifest.loc[train_mask, "subject"])
    te = set(manifest.loc[test_mask, "subject"])
    overlap = tr & te
    if overlap:
        raise ValueError(
            f"SUBJECT LEAKAGE{' in ' + context if context else ''}: "
            f"{len(overlap)} subject(s) appear in both train and test "
            f"(e.g. {sorted(overlap)[:5]}). Any metric from this split is meaningless."
        )


def fold_report(manifest: pd.DataFrame, folds: np.ndarray) -> pd.DataFrame:
    """Test-subject counts per class per fold -- makes the Moderate problem visible."""
    df = manifest.assign(fold=folds)
    rows = []
    for k in sorted(df["fold"].unique()):
        te = df[df.fold == k]
        r = {"fold": k, "test_subjects": te["subject"].nunique(), "test_slices": len(te)}
        for label, name in enumerate(["Non", "VeryMild", "Mild", "Moderate"]):
            r[name] = te[te.label == label]["subject"].nunique()
        rows.append(r)
    return pd.DataFrame(rows)


if __name__ == "__main__":
    repo = Path(__file__).resolve().parents[3]
    mf = pd.read_csv(repo / "cache" / "manifest.csv")

    folds = make_folds(mf, n_folds=5, seed=1337)
    holdout = subject_holdout(mf, seed=1337)

    mf_out = mf[["path", "subject", "label"]].copy()
    mf_out["fold"] = folds
    mf_out["holdout"] = holdout
    mf_out.to_csv(repo / "cache" / "splits.csv", index=False)

    print("=== 5-fold subject-grouped CV: test subjects per class ===")
    print(fold_report(mf, folds).to_string(index=False))

    print("\n=== Stage A holdout (by subject) ===")
    hs = mf.assign(h=holdout).groupby("h").agg(
        subjects=("subject", "nunique"), slices=("path", "size"))
    print(hs.to_string())
    for split in ["train", "val", "test"]:
        cls = mf.assign(h=holdout)
        cls = cls[cls.h == split].groupby("class_name")["subject"].nunique()
        print(f"  {split:5s}: {cls.to_dict()}")

    # Verify the guard actually fires -- a guard nobody has seen fail is a guess.
    print("\n=== leakage guard self-test ===")
    for name, mask_fn in [
        ("grouped split (should PASS)", lambda: (holdout == "train", holdout == "test")),
        ("random slice split (should FAIL)", lambda: (
            (r := random_slice_split(mf)) == "train", r == "test")),
    ]:
        tr, te = mask_fn()
        try:
            assert_no_subject_leakage(mf, tr, te, name)
            print(f"  {name}: no leakage detected")
        except ValueError as e:
            print(f"  {name}: RAISED -> {str(e)[:110]}...")
    print(f"\nWrote {repo / 'cache' / 'splits.csv'}")
