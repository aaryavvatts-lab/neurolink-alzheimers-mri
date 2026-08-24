"use client";
import type { Results } from "@/lib/types";
import { Note, Stat } from "./ui";

export default function Leakage({ r }: { r: Results }) {
  const lk = r.leakage_experiment;
  if (!lk) return <Note>The leakage experiment has not been run yet.</Note>;

  const rows = [
    { label: "Random slice split", sub: "the naive approach", ...lk.leaky_random_split, bad: true },
    { label: "Subject split · per slice", sub: "no patient in both sets", ...lk.honest_subject_split_slice_level, bad: false },
    { label: "Subject split · per patient", sub: "the number worth quoting", ...lk.honest_subject_split_subject_level, bad: false },
  ];
  const max = Math.max(...rows.map((x) => x.accuracy));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat tone="warn" value={`${(lk.leaky_random_split.accuracy * 100).toFixed(1)}%`}
          label="Accuracy when slices are shuffled at random" sub="the impressive, meaningless number" />
        <Stat value={`${(lk.honest_subject_split_slice_level.accuracy * 100).toFixed(1)}%`}
          label="Same model, same epochs, split by patient instead" sub="the honest number" />
        <Stat tone="warn" value={`${lk.inflation.accuracy_points > 0 ? "+" : ""}${lk.inflation.accuracy_points} pts`}
          label="Accuracy manufactured purely by the split" sub="not by any modelling choice" />
      </div>

      <div className="card p-5 space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-slate-200">
                {row.label} <span className="text-muted">— {row.sub}</span>
              </span>
              <span className="mono tabular-nums text-muted">
                acc {row.accuracy.toFixed(3)} · balanced {row.balanced_accuracy.toFixed(3)}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-line/60">
              <div className={`h-3 rounded-full ${row.bad ? "bg-warn" : "bg-accent"}`}
                style={{ width: `${(row.accuracy / max) * 100}%` }} />
            </div>
          </div>
        ))}
        <p className="text-[11px] text-muted">
          Same architecture ({lk.model}), same {lk.epochs} epochs, same seed, same images. The
          only thing that changed is which side of the train/test boundary each slice landed on.
        </p>
      </div>

      <Note tone="warn">
        Under the random split, <strong>all {lk.leaky_random_split.subjects_in_both_train_and_test} subjects
        appeared in both the training and test sets</strong> — not some of them, every one. Each
        patient contributes about 244 slices from adjacent positions in the same skull, so the
        network can score nearly perfectly by recognising the person and recalling their label. It
        never has to learn what dementia looks like.
      </Note>
    </div>
  );
}
