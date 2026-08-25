"""Build the dataset manifest.

Every OASIS filename encodes the sample's provenance:

    OAS1_0028_MR1_mpr-1_100.jpg
    |-------| |-| |---| |-|
    subject   ses scan  slice

The subject ID is the single most important field in this project. 86,437 images
come from only 347 people (~244 images each: 4 scans x 61 axial slices). Any
split that ignores the subject column puts slice 119 and slice 120 of the SAME
brain on opposite sides of the train/test boundary, and the resulting accuracy is
a measure of memorisation, not diagnosis.
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ..constants import CLASS_DIRS, EXPECTED_IMAGES, EXPECTED_SUBJECTS

# OAS1_0028_MR1_mpr-1_100.jpg  ->  subject, session, scan, slice
FNAME_RE = re.compile(
    r"^(?P<subject>OAS1_\d{4})_(?P<session>MR\d+)_(?P<scan>mpr-\d+)_(?P<slice>\d+)\.jpg$",
    re.IGNORECASE,
)


def build_manifest(data_dir: str | Path) -> pd.DataFrame:
    """Walk the class directories and parse every filename into a row."""
    data_dir = Path(data_dir)
    rows, unparsed = [], []

    for class_dir, (label, cdr) in CLASS_DIRS.items():
        d = data_dir / class_dir
        if not d.is_dir():
            raise FileNotFoundError(f"Missing class directory: {d}")
        for p in sorted(d.glob("*.jpg")):
            m = FNAME_RE.match(p.name)
            if not m:
                unparsed.append(str(p))
                continue
            rows.append(
                {
                    "path": f"{class_dir}/{p.name}",
                    "subject": m["subject"],
                    "session": m["session"],
                    "scan": m["scan"],
                    "slice_idx": int(m["slice"]),
                    "label": label,
                    "cdr": cdr,
                    "class_name": class_dir,
                }
            )

    if unparsed:
        raise ValueError(
            f"{len(unparsed)} filenames did not match the expected OASIS pattern, "
            f"e.g. {unparsed[:3]}. Refusing to build a manifest with unknown provenance."
        )

    df = pd.DataFrame(rows).sort_values(["subject", "scan", "slice_idx"]).reset_index(drop=True)
    validate_manifest(df)
    return df


def validate_manifest(df: pd.DataFrame) -> None:
    """Hard assertions. A silently truncated dataset must never reach training."""
    n_img, n_subj = len(df), df["subject"].nunique()

    # A subject with two different labels would mean the class folders disagree
    # about that person's diagnosis -- which would poison grouped splitting.
    multi = df.groupby("subject")["label"].nunique()
    offenders = multi[multi > 1]
    if len(offenders):
        raise ValueError(
            f"{len(offenders)} subject(s) appear under more than one class: "
            f"{list(offenders.index[:5])}. Grouped splitting assumes one label per subject."
        )

    if n_img != EXPECTED_IMAGES:
        print(f"  WARNING: {n_img} images, expected {EXPECTED_IMAGES}")
    if n_subj != EXPECTED_SUBJECTS:
        print(f"  WARNING: {n_subj} subjects, expected {EXPECTED_SUBJECTS}")


def summarise(df: pd.DataFrame) -> pd.DataFrame:
    """The table that reframes this whole project: images vs actual people."""
    g = df.groupby("class_name").agg(
        images=("path", "size"),
        subjects=("subject", "nunique"),
        cdr=("cdr", "first"),
    )
    g["images_pct"] = (100 * g["images"] / g["images"].sum()).round(1)
    g["subjects_pct"] = (100 * g["subjects"] / g["subjects"].sum()).round(1)
    return g.sort_values("cdr")


if __name__ == "__main__":
    import sys

    repo = Path(__file__).resolve().parents[3]
    df = build_manifest(repo / "data")
    out = repo / "cache" / "manifest.csv"
    out.parent.mkdir(exist_ok=True)
    df.to_csv(out, index=False)

    print(f"\nManifest: {len(df):,} images from {df['subject'].nunique()} subjects -> {out}\n")
    print(summarise(df).to_string())
    print(f"\nImages per subject: min={df.groupby('subject').size().min()} "
          f"median={int(df.groupby('subject').size().median())} "
          f"max={df.groupby('subject').size().max()}")
    print(f"Slice index range: {df['slice_idx'].min()}-{df['slice_idx'].max()}")
    print(f"Scans per subject: {df.groupby('subject')['scan'].nunique().value_counts().to_dict()}")
