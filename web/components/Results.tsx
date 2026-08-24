"use client";
import type { Results, RunBlock } from "@/lib/types";
import { SHORT } from "@/lib/types";
import { Bar, ConfusionMatrix, Note, Stat } from "./ui";

function MetricGrid({ run }: { run: RunBlock }) {
  const s = run.subject_level;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat value={s.balanced_accuracy.toFixed(3)} label="Balanced accuracy (4 classes)" sub="chance = 0.250" />
      <Stat value={s.quadratic_kappa.toFixed(3)} label="Quadratic weighted kappa" sub="credits near-misses on an ordinal scale" />
      <Stat value={s.binary_screening.roc_auc.toFixed(3)} label="ROC-AUC, any dementia vs none" sub="the screening question" />
      <Stat value={`${s.n}`} label="Patients evaluated" sub="one prediction per person" />
    </div>
  );
}

export default function ResultsSection({ r }: { r: Results }) {
  const primaryKey = r.primary_run;
  const primary = primaryKey ? r.runs[primaryKey] : undefined;
  if (!primary) return <Note>No completed honest run yet.</Note>;

  const s = primary.subject_level;
  const base = r.ventricle_baseline;
  const cv = r.crossval;

  return (
    <div className="space-y-8">
      <MetricGrid run={primary} />

      {cv && (
        <div className="card p-5">
          <p className="mb-3 text-sm font-medium text-white">
            Pooled {cv.n_folds}-fold cross-validation — all {cv.n_subjects_pooled} patients
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat value={cv.pooled_subject_level.balanced_accuracy.toFixed(3)} label="Balanced accuracy, pooled out-of-fold" />
            <Stat value={cv.pooled_subject_level.binary_screening.roc_auc.toFixed(3)} label="Binary screening ROC-AUC" />
            <Stat value={`±${cv.fold_spread.subject_balanced_accuracy_std.toFixed(3)}`}
              label="Std. dev. across folds"
              sub={`range ${cv.fold_spread.subject_balanced_accuracy_min.toFixed(3)}–${cv.fold_spread.subject_balanced_accuracy_max.toFixed(3)}`} />
          </div>
          <p className="mt-3 text-[11px] text-muted">
            With roughly 69 test patients per fold, the spread between folds is wide. A single
            split&apos;s number would look more precise than the evidence supports.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <p className="mb-3 text-sm font-medium text-white">Per-patient confusion — 4 stages</p>
          <ConfusionMatrix cm={s.confusion_matrix} names={SHORT}
            caption="Cell shows patient count and the share of that true class." />
        </div>
        <div className="card p-5">
          <p className="mb-3 text-sm font-medium text-white">Collapsed to the screening question</p>
          <ConfusionMatrix cm={s.binary_screening.confusion_matrix} names={["No dementia", "Any dementia"]} />
          <div className="mt-4 space-y-2">
            <Bar label="Sensitivity — dementia cases caught" value={s.binary_screening.sensitivity} tone="good" />
            <Bar label="Specificity — healthy correctly cleared" value={s.binary_screening.specificity} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <p className="mb-3 text-sm font-medium text-white">Per-class recall</p>
        <div className="space-y-3">
          {s.per_class.map((pc, i) => (
            <div key={i}>
              <Bar label={`${SHORT[i]} — ${pc.support} patient${pc.support === 1 ? "" : "s"} in test`}
                value={pc.recall} right={pc.support ? pc.recall.toFixed(3) : "—"} 
                tone={pc.support <= 3 ? "warn" : "accent"} />
              {pc.support > 0 && pc.support <= 3 && (
                <p className="mt-1 text-[11px] text-warn/80">
                  Only {pc.support} test patient{pc.support === 1 ? "" : "s"} — this figure is an
                  anecdote, not an estimate.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {base && (
        <div className="card p-5">
          <p className="mb-1 text-sm font-medium text-white">Does the network beat a ruler?</p>
          <p className="mb-4 text-xs text-muted">
            A logistic regression on eight hand-measured numbers — chiefly the ventricle-to-brain
            area ratio — evaluated on the identical patient-grouped split.
          </p>
          <div className="space-y-3">
            <Bar label="Convolutional network" value={s.balanced_accuracy} tone="accent" />
            <Bar label="Ventricle morphometry + logistic regression"
              value={base.subject_level.balanced_accuracy} tone="good" />
          </div>
          <p className="mt-3 text-[11px] text-muted">
            {s.balanced_accuracy > base.subject_level.balanced_accuracy + 0.03
              ? "The network is meaningfully ahead, so it is reading more than ventricle size."
              : "The network does not clearly beat the simple measurement — on this dataset the extra complexity is not obviously earning its place."}
          </p>
        </div>
      )}

      <div className="card p-5">
        <p className="mb-1 text-sm font-medium text-white">Knowing when to defer</p>
        <p className="mb-4 text-xs text-muted">
          Accuracy if the model hands its least-confident patients to a clinician instead of
          guessing. Confidences are temperature-scaled on validation data
          (T = {primary.calibration.temperature.toFixed(2)}).
        </p>
        <div className="scroll-x">
          <table className="w-full min-w-[420px] text-xs">
            <thead className="text-muted">
              <tr>
                <th className="p-2 text-left font-normal">Coverage</th>
                <th className="p-2 text-left font-normal">Patients ruled on</th>
                <th className="p-2 text-left font-normal">Accuracy on those</th>
              </tr>
            </thead>
            <tbody>
              {primary.abstention_subject
                .filter((_, i) => i % 4 === 0)
                .map((a) => (
                  <tr key={a.coverage} className="border-t border-line/50">
                    <td className="p-2 tabular-nums">{(a.coverage * 100).toFixed(0)}%</td>
                    <td className="p-2 tabular-nums text-muted">
                      {Math.round(a.coverage * s.n)} of {s.n}
                    </td>
                    <td className="p-2 tabular-nums">{(a.accuracy * 100).toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
