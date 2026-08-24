"use client";

import { useEffect, useState } from "react";
import Demo from "@/components/Demo";
import Explain from "@/components/Explain";
import Leakage from "@/components/Leakage";
import Method from "@/components/Method";
import ResultsSection from "@/components/Results";
import { Note, Section, Stat } from "@/components/ui";
import type { Results } from "@/lib/types";

const NAV = [
  ["finding", "The finding"],
  ["demo", "Live demo"],
  ["method", "Method"],
  ["results", "Results"],
  ["explain", "Explainability"],
  ["limits", "Limitations"],
];

export default function Page() {
  const [r, setR] = useState<Results | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/results.json")
      .then((x) => (x.ok ? x.json() : Promise.reject()))
      .then(setR)
      .catch(() => setErr(true));
  }, []);

  const lk = r?.leakage_experiment;
  const primary = r?.primary_run ? r.runs[r.primary_run] : undefined;

  return (
    <main>
      {/* nav */}
      <nav className="sticky top-[33px] z-40 border-b border-line/50 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 text-xs">
          <span className="mr-3 shrink-0 font-semibold text-white">NeuroLink</span>
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`}
              className="shrink-0 rounded-md px-2.5 py-1 text-muted hover:bg-panel hover:text-white">
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* hero */}
      <header className="mx-auto max-w-6xl px-4 pb-6 pt-16 sm:pt-24">
        <p className="pill mb-5">OASIS-1 · 86,437 MRI slices · 347 patients</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl">
          Staging Alzheimer&apos;s from brain MRI —{" "}
          <span className="text-accent">and why the easy version of this is a mirage.</span>
        </h1>
        <p className="lead mt-6 max-w-2xl">
          A convolutional network that reads an axial MRI slice and predicts a Clinical Dementia
          Rating stage. It runs entirely in your browser. The interesting part is not that it
          works — it is how much worse it gets the moment you evaluate it honestly.
        </p>

        {lk && (
          <div className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
            <Stat tone="warn" value={`${(lk.leaky_random_split.accuracy * 100).toFixed(1)}%`}
              label="Accuracy when slices are split at random" sub="the number tutorials report" />
            <Stat value={`${(lk.honest_subject_split_slice_level.accuracy * 100).toFixed(1)}%`}
              label="Same model, split by patient instead" sub="the number that means something" />
            <Stat value={`${r?.dataset.total_subjects ?? "—"}`}
              label="Patients the data actually contains" sub={`not ${(r?.dataset.total_images ?? 0).toLocaleString()} samples`} />
          </div>
        )}

        {err && (
          <div className="mt-10 max-w-2xl">
            <Note tone="warn">
              <span className="mono">results.json</span> has not been generated yet. Run{" "}
              <span className="mono">scripts/run_stage_a.sh</span>, then{" "}
              <span className="mono">python -m src.neurolink.report</span>.
            </Note>
          </div>
        )}
      </header>

      {r && (
        <>
          <Section id="finding" eyebrow="The finding"
            title="86,437 images. 347 people. One very expensive mistake.">
            <p className="lead mb-6 max-w-3xl">
              Each patient in OASIS-1 contributes about 244 images: four repeat scans, sixty-one
              adjacent axial slices each. Slice 119 and slice 120 of the same skull are nearly the
              same picture. Shuffle those images randomly into train and test, and the network can
              score almost perfectly by recognising the <em>person</em> and recalling their label —
              without ever learning what dementia looks like.
            </p>
            <Leakage r={r} />
          </Section>

          <Section id="demo" eyebrow="Live demo" title="Run the model on a brain">
            <p className="lead mb-6 max-w-3xl">
              The network is downloaded to your device and executed locally with WebAssembly —
              nothing is uploaded. Warm colours show which regions carried the most weight for the
              predicted class, computed from the classifier&apos;s own weights.
            </p>
            <Demo />
          </Section>

          <Section id="method" eyebrow="Method" title="What the data really is, and how it is handled">
            <Method r={r} />
          </Section>

          <Section id="results" eyebrow="Results" title="What it can and cannot do">
            <p className="lead mb-6 max-w-3xl">
              Every figure below is measured per <em>patient</em>, by averaging the model&apos;s
              output across all of that person&apos;s slices. A radiologist reads a volume, not one
              axial cut, and 347 people — not 86,437 pictures — is the real sample size.
            </p>
            <ResultsSection r={r} />
          </Section>

          <Section id="explain" eyebrow="Explainability" title="Is it right for the right reasons?">
            <Explain r={r} />
          </Section>

          <Section id="limits" eyebrow="Limitations" title="What would have to be true for this to matter">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["347 patients is a small study.", `Splitting by person leaves roughly ${primary?.n_test_subjects ?? 69} people in any test set. Confidence intervals on every number here are wide, and fold-to-fold variation is large.`],
                ["Moderate Dementia has two patients.", "Not two hundred — two. Any per-class figure for that stage describes one or two individuals and should be read as an anecdote."],
                ["One scanner, one site, one moment.", "OASIS-1 is cross-sectional and single-site. Nothing here demonstrates that the model would survive a different scanner, protocol, or population."],
                ["CDR is a clinical rating, not ground truth.", "Labels come from clinician-assigned Clinical Dementia Rating scores, not autopsy confirmation. The model can at best learn to imitate that rating."],
                ["A single 2D slice is not a diagnosis.", "Real radiological assessment uses the whole volume, plus history, cognitive testing and often other modalities. One axial cut discards most of the evidence."],
                ["Class imbalance flatters raw accuracy.", "78% of slices are non-demented, so predicting 'no dementia' for everyone scores 0.78 accuracy and 0.25 balanced accuracy. That is why balanced accuracy and kappa lead here."],
              ].map(([t, d]) => (
                <div key={t} className="card p-5">
                  <p className="mb-1.5 text-sm font-medium text-white">{t}</p>
                  <p className="text-xs leading-relaxed text-muted">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Note tone="warn">
                <strong>This is a research demonstration, not a medical device.</strong> It is not
                validated, not regulated, and not fit to inform any decision about any real person.
                If you are worried about memory symptoms, see a doctor.
              </Note>
            </div>
          </Section>
        </>
      )}
    </main>
  );
}
