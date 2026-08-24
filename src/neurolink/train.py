"""Train one model on one split.

Every run begins by asserting that no subject crosses the train/test boundary --
except in `--split-mode random_slice`, which exists solely to reproduce the naive
approach and is force-labelled as leaking in its own output.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, WeightedRandomSampler
from tqdm import tqdm

from .constants import N_CLASSES, SHORT_NAMES
from .data.dataset import SliceDataset, to_model_input
from .data.splits import assert_no_subject_leakage, random_slice_split, subject_holdout
from .metrics import classification_metrics
from .models.transfer import build_model
from . import jsonio

REPO = Path(__file__).resolve().parents[2]


def get_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def make_splits(mf: pd.DataFrame, mode: str, fold: int, seed: int):
    """Returns (train_mask, val_mask, test_mask, leaking: bool)."""
    if mode == "holdout":
        h = subject_holdout(mf, seed=seed)
        return h == "train", h == "val", h == "test", False
    if mode == "random_slice":
        h = random_slice_split(mf, seed=seed)
        return h == "train", h == "val", h == "test", True
    if mode == "fold":
        splits = pd.read_csv(REPO / "cache" / "splits.csv")
        folds = splits["fold"].to_numpy()
        test = folds == fold
        # Use the next fold as validation so val is also subject-disjoint.
        val = folds == ((fold + 1) % int(folds.max() + 1))
        return ~(test | val), val, test, False
    raise ValueError(f"unknown split mode: {mode}")


def evaluate(model, loader, device, train_size=None, n_classes=N_CLASSES):
    model.eval()
    P, Y, R = [], [], []
    with torch.no_grad():
        for x, y, rows in loader:
            logits = model(to_model_input(x, train=False, device=device, size=train_size))
            P.append(torch.softmax(logits.float(), dim=1).cpu().numpy())
            Y.append(y.numpy())
            R.append(rows.numpy())
    return np.concatenate(P), np.concatenate(Y), np.concatenate(R)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="resnet18")
    ap.add_argument("--split-mode", default="holdout", choices=["holdout", "fold", "random_slice"])
    ap.add_argument("--fold", type=int, default=0)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch-size", type=int, default=96)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--label-smoothing", type=float, default=0.05)
    ap.add_argument("--slice-stride", type=int, default=1)
    ap.add_argument("--num-workers", type=int, default=2)
    ap.add_argument("--size", type=int, default=224, help="cache resolution")
    ap.add_argument("--train-size", type=int, default=176,
                    help="resolution fed to the model (GPU-downsampled from cache)")
    ap.add_argument("--val-stride", type=int, default=4,
                    help="subsample validation; it runs every epoch and is only used for model selection")
    ap.add_argument("--test-stride", type=int, default=1,
                    help="subsample the test set. Keep at 1 for reported results; >1 is smoke-test only")
    ap.add_argument("--seed", type=int, default=1337)
    ap.add_argument("--mask-mode", default=None, choices=[None, "brain_removed", "brain_only"])
    ap.add_argument("--no-pretrained", action="store_true")
    ap.add_argument("--patience", type=int, default=4)
    ap.add_argument("--tag", default=None)
    ap.add_argument("--max-train-batches", type=int, default=0, help="smoke-test cap")
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    tag = args.tag or f"{args.model}_{args.split_mode}" + (
        f"_fold{args.fold}" if args.split_mode == "fold" else "") + (
        f"_{args.mask_mode}" if args.mask_mode else "")
    out_dir = REPO / "runs" / tag
    out_dir.mkdir(parents=True, exist_ok=True)

    mf = pd.read_csv(REPO / "cache" / "manifest.csv")
    tr_m, va_m, te_m, leaking = make_splits(mf, args.split_mode, args.fold, args.seed)

    print(f"\n{'=' * 72}\nRUN: {tag}\n{'=' * 72}")
    if leaking:
        print("!! SPLIT MODE 'random_slice' -- subjects DO cross the train/test boundary.")
        print("!! This run is a deliberate demonstration of leakage. Its accuracy is NOT a")
        print("!! measure of diagnostic skill and must never be reported as one.")
        tr_s = set(mf.loc[tr_m, "subject"]); te_s = set(mf.loc[te_m, "subject"])
        print(f"!! subjects in both train and test: {len(tr_s & te_s)} of {mf.subject.nunique()}")
    else:
        assert_no_subject_leakage(mf, tr_m, te_m, f"{tag} train/test")
        assert_no_subject_leakage(mf, tr_m, va_m, f"{tag} train/val")
        print("Leakage guard: PASSED (no subject spans train/test or train/val)")

    idx = np.arange(len(mf))
    slice_idx = mf["slice_idx"].to_numpy()
    if args.slice_stride > 1:
        tr_m = tr_m & ((slice_idx % args.slice_stride) == 0)
        print(f"slice stride {args.slice_stride}: training on every {args.slice_stride}th slice")
    if args.test_stride > 1:
        te_m = te_m & ((slice_idx % args.test_stride) == 0)
        print(f"!! test stride {args.test_stride}: TEST SET SUBSAMPLED — smoke-test only, "
              f"NOT a reportable result")
    if args.val_stride > 1:
        # Validation runs after EVERY epoch and only picks the best checkpoint.
        # Scoring all 12,444 slices each time costs more than the training epoch
        # itself; every 4th slice selects the same checkpoint.
        va_m = va_m & ((slice_idx % args.val_stride) == 0)
        print(f"val stride {args.val_stride}: validating on every {args.val_stride}th slice")

    tr_i, va_i, te_i = idx[tr_m], idx[va_m], idx[te_m]
    labels = mf["label"].to_numpy()
    print(f"train {len(tr_i):,} | val {len(va_i):,} | test {len(te_i):,} slices")
    print(f"train subjects {mf.loc[tr_m,'subject'].nunique()} | "
          f"test subjects {mf.loc[te_m,'subject'].nunique()}")

    ds_kw = dict(repo=REPO, size=args.size, mask_mode=args.mask_mode)
    tr_ds = SliceDataset(indices=tr_i, labels=labels[tr_i], train=True, **ds_kw)
    va_ds = SliceDataset(indices=va_i, labels=labels[va_i], train=False, **ds_kw)
    te_ds = SliceDataset(indices=te_i, labels=labels[te_i], train=False, **ds_kw)

    # 77.8% of slices are Non-Demented. Without rebalancing, predicting "Non"
    # for everything scores 0.78 accuracy and 0.25 balanced accuracy -- the
    # classic way this project produces an impressive-looking useless model.
    counts = np.bincount(labels[tr_i], minlength=N_CLASSES).astype(float)
    inv = np.where(counts > 0, 1.0 / np.maximum(counts, 1), 0.0)
    sample_w = inv[labels[tr_i]]
    sampler = WeightedRandomSampler(
        torch.as_tensor(sample_w, dtype=torch.double), num_samples=len(tr_i), replacement=True)
    print("train class counts:", dict(zip(SHORT_NAMES, counts.astype(int).tolist())))

    dl_kw = dict(num_workers=args.num_workers, pin_memory=False,
                 persistent_workers=args.num_workers > 0)
    tr_dl = DataLoader(tr_ds, batch_size=args.batch_size, sampler=sampler, drop_last=True, **dl_kw)
    va_dl = DataLoader(va_ds, batch_size=args.batch_size * 2, shuffle=False, **dl_kw)
    te_dl = DataLoader(te_ds, batch_size=args.batch_size * 2, shuffle=False, **dl_kw)

    device = get_device()
    model = build_model(args.model, N_CLASSES, pretrained=not args.no_pretrained).to(device)
    n_par = sum(p.numel() for p in model.parameters()) / 1e6
    print(f"model {args.model} ({n_par:.1f}M params) on {device} at {args.train_size}px")

    # Mild class weighting on top of the sampler: the sampler fixes the marginal,
    # the weights keep rare-class errors expensive.
    cw = torch.as_tensor((inv / inv[inv > 0].mean()).clip(0.5, 3.0), dtype=torch.float32, device=device)
    crit = nn.CrossEntropyLoss(weight=cw, label_smoothing=args.label_smoothing)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    steps = max(1, len(tr_dl)) * args.epochs
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=steps, pct_start=0.25)

    history, best_score, best_epoch, t0 = [], -1.0, -1, time.time()
    for ep in range(args.epochs):
        model.train()
        tot, seen, correct = 0.0, 0, 0
        pbar = tqdm(tr_dl, desc=f"epoch {ep + 1}/{args.epochs}", unit="b")
        for bi, (x, y, _) in enumerate(pbar):
            if args.max_train_batches and bi >= args.max_train_batches:
                break
            x = to_model_input(x, train=True, device=device, size=args.train_size)
            y = y.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            logits = model(x)
            loss = crit(logits, y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            opt.step()
            if sched.last_epoch < steps - 1:
                sched.step()
            tot += loss.item() * len(y); seen += len(y)
            correct += (logits.argmax(1) == y).sum().item()
            if bi % 20 == 0:
                pbar.set_postfix(loss=f"{tot / seen:.3f}", acc=f"{correct / seen:.3f}")

        vp, vy, _ = evaluate(model, va_dl, device, args.train_size)
        vm = classification_metrics(vy, vp.argmax(1), vp)
        score = vm["balanced_accuracy"]
        history.append({"epoch": ep + 1, "train_loss": tot / max(seen, 1),
                        "val_balanced_accuracy": score, "val_accuracy": vm["accuracy"],
                        "val_quadratic_kappa": vm["quadratic_kappa"],
                        "lr": sched.get_last_lr()[0]})
        print(f"  epoch {ep + 1}: val balanced-acc {score:.4f} | acc {vm['accuracy']:.4f} "
              f"| kappa {vm['quadratic_kappa']:.4f}")

        if score > best_score:
            best_score, best_epoch = score, ep + 1
            torch.save({"model": model.state_dict(), "arch": args.model,
                        "epoch": ep + 1, "val_balanced_accuracy": score,
                        "args": vars(args)}, out_dir / "best.pt")
        elif ep + 1 - best_epoch >= args.patience:
            print(f"  early stop: no improvement for {args.patience} epochs")
            break

    model.load_state_dict(torch.load(out_dir / "best.pt", map_location=device)["model"])
    tp, ty, tr_rows = evaluate(model, te_dl, device, args.train_size)
    subjects = mf["subject"].to_numpy()[tr_rows]
    np.savez_compressed(out_dir / "test_predictions.npz",
                        probs=tp, y_true=ty, rows=tr_rows, subjects=subjects)

    # Validation predictions from the SAME checkpoint, so temperature scaling can
    # be fitted on val and applied to test without touching test labels.
    vp2, vy2, v_rows = evaluate(model, va_dl, device, args.train_size)
    np.savez_compressed(out_dir / "val_predictions.npz",
                        probs=vp2, y_true=vy2, rows=v_rows,
                        subjects=mf["subject"].to_numpy()[v_rows])

    tm = classification_metrics(ty, tp.argmax(1), tp)
    summary = {
        "tag": tag, "model": args.model, "split_mode": args.split_mode,
        "fold": args.fold if args.split_mode == "fold" else None,
        "mask_mode": args.mask_mode, "leaking_split": leaking,
        "test_stride": args.test_stride,
        "best_epoch": best_epoch, "epochs_run": len(history),
        "minutes": round((time.time() - t0) / 60, 2),
        "n_train_slices": int(len(tr_i)), "n_test_slices": int(len(te_i)),
        "train_size": args.train_size,
        "n_train_subjects": int(mf.loc[tr_m, "subject"].nunique()),
        "n_test_subjects": int(mf.loc[te_m, "subject"].nunique()),
        "slice_level": tm, "history": history,
    }
    jsonio.write(out_dir / "summary.json", summary)

    print(f"\n--- {tag} test (slice level) ---")
    print(f"  accuracy          {tm['accuracy']:.4f}")
    print(f"  balanced accuracy {tm['balanced_accuracy']:.4f}")
    print(f"  macro F1          {tm['macro_f1']:.4f}")
    print(f"  quadratic kappa   {tm['quadratic_kappa']:.4f}")
    print(f"  binary ROC-AUC    {tm['binary_screening']['roc_auc']:.4f}")
    print(f"  ({summary['minutes']} min, best epoch {best_epoch})")
    print(f"Saved -> {out_dir}")


if __name__ == "__main__":
    main()
