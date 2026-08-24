"use client";
import type { Results } from "@/lib/types";
import { Note } from "./ui";

const STEPS = [
  { n: 1, t: "Grayscale", d: "Files are stored 3-channel but the channels are byte-identical — verified across 200 random files. MRI is single-channel intensity data." },
  { n: 2, t: "Un-squash", d: "Every file is 496×248: a 248×248 axial slice stretched 2× horizontally. Resizing to square restores true anatomical proportions. Skipping this trains the network on systematically distorted brains." },
  { n: 3, t: "Crop to the head", d: "Square bounding box around the head with a 4% margin, so the network sees anatomy rather than framing. Found with a low absolute threshold against the black background — not Otsu, which picks a tissue-level threshold and shatters dim scans." },
  { n: 4, t: "Normalise intensity", d: "Clip to the 1st–99th percentile computed inside the head mask only. Over the whole frame the percentiles would mostly measure how much black background there is." },
  { n: 5, t: "Resize and cache", d: "224×224 uint8 in one contiguous memmap. Epochs then read raw bytes instead of decoding 86,437 JPEGs, which is what makes cross-validation feasible at all." },
];

export default function Method({ r }: { r: Results }) {
  const d = r.dataset;
  return (
    <div className="space-y-8">
      <Note tone="warn">
        <strong>The dataset is smaller than it looks.</strong> {d.total_images.toLocaleString()} images
        sounds like a large sample, but they come from just <strong>{d.total_subjects} people</strong> —
        roughly {d.slices_per_subject_median} slices each, spanning positions{" "}
        {d.slice_index_range[0]}–{d.slice_index_range[1]} of four repeat scans. The real sample
        size is {d.total_subjects}, and one class has two.
      </Note>

      <div className="card p-5">
        <p className="mb-4 text-sm font-medium text-white">Images versus people</p>
        <div className="scroll-x">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="p-2 text-left font-normal">Stage</th>
                <th className="p-2 text-right font-normal">CDR</th>
                <th className="p-2 text-right font-normal">Images</th>
                <th className="p-2 text-right font-normal">Share</th>
                <th className="p-2 text-right font-normal">People</th>
              </tr>
            </thead>
            <tbody>
              {d.classes.map((c) => (
                <tr key={c.name} className="border-b border-line/40">
                  <td className="p-2">{c.name}</td>
                  <td className="p-2 text-right tabular-nums text-muted">{c.cdr}</td>
                  <td className="p-2 text-right tabular-nums">{c.images.toLocaleString()}</td>
                  <td className="p-2 text-right tabular-nums text-muted">{c.images_pct}%</td>
                  <td className={`p-2 text-right tabular-nums font-semibold ${c.subjects <= 3 ? "text-warn" : ""}`}>
                    {c.subjects}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Moderate Dementia has 488 images and <span className="text-warn">two patients</span>. No
          split, no amount of augmentation and no cross-validation scheme can turn two people into
          a population. Every Moderate number on this site is flagged as an anecdote.
        </p>
      </div>

      <div className="card p-5">
        <p className="mb-4 text-sm font-medium text-white">Preprocessing</p>
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/50 text-xs text-accent">
                {s.n}
              </span>
              <div>
                <p className="text-sm text-white">{s.t}</p>
                <p className="text-xs leading-relaxed text-muted">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="card p-5">
        <p className="mb-2 text-sm font-medium text-white">Splitting, and the guard that enforces it</p>
        <p className="lead mb-3">
          Splits are made with <span className="mono">StratifiedGroupKFold</span> grouped on patient
          ID, so a person lands on exactly one side of the boundary. Every training run calls a
          guard first, which <em>raises</em> rather than warns:
        </p>
        <pre className="scroll-x rounded-lg border border-line bg-black/40 p-3 mono text-slate-300">
{`overlap = set(train_subjects) & set(test_subjects)
if overlap:
    raise ValueError(f"SUBJECT LEAKAGE: {len(overlap)} subject(s) "
                     "appear in both train and test. Any metric "
                     "from this split is meaningless.")`}
        </pre>
        <p className="mt-3 text-[11px] text-muted">
          The guard has a self-test that deliberately feeds it a random slice split to confirm it
          fires. A check nobody has ever seen fail is a guess, not a check.
        </p>
      </div>
    </div>
  );
}
