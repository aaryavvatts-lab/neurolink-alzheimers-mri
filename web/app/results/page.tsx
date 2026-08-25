"use client";

import Link from "next/link";
import { useResults } from "@/lib/useResults";
import { SHORT, fmt } from "@/lib/types";
import { Callout, Chart, Figure, Page, Prose, Section, Stat } from "@/components/ui";
import { Loading, LoadError } from "@/components/Loading";
import ConfusionMatrix from "@/components/charts/ConfusionMatrix";
import RocCurve from "@/components/charts/RocCurve";
import CoverageSlider from "@/components/charts/CoverageSlider";
import SliceAccuracy from "@/components/charts/SliceAccuracy";
import ModelCompare from "@/components/charts/ModelCompare";

export default function ResultsPage() {
  const { data: r, error } = useResults();
  const key = r?.primary_run;
  const run = key ? r!.runs[key] : undefined;

  return (
    <Page
      eyebrow="Results"
      title="What it can do, and where it gives up"
      lede="Every number here is measured on patients the model never trained on, and scored one answer per patient rather than one answer per picture."
    >
      {error && <div className="py-8"><LoadError /></div>}
      {!r && !error && <Loading />}

      {r && run && (
        <>
          <Section n="1" title="Headline numbers">
            <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value={fmt(run.subject_level.balanced_accuracy)}
                    label="Balanced accuracy across four stages"
                    note="random guessing gives 0.250" />
              <Stat value={fmt(run.subject_level.quadratic_kappa)}
                    label="Agreement with the clinician"
                    note="a near miss counts better than a wild miss" />
              <Stat tone="forest" value={fmt(run.subject_level.binary_screening.roc_auc)}
                    label="Dementia or no dementia"
                    note="area under the curve, per patient" />
              <Stat value={`${run.subject_level.n}`}
                    label="Patients in the test set"
                    note={`held out of training entirely`} />
            </div>

            <div className="max-w-prose">
              <Prose>
                <p>
                  Two of these look fine and two look poor, and that is the honest summary.
                  Sorting patients into four stages does not work well. Separating people with
                  some dementia from people with none works a lot better.
                </p>
              </Prose>
            </div>
          </Section>

          <Section n="2" title="Four ways of doing it, side by side">
            <div className="mb-6 max-w-prose">
              <Prose>
                <p>
                  It is easy to train one model, get a number, and stop. The number only means
                  something next to other numbers, so here are four approaches measured on the
                  same patients with the same split.
                </p>
              </Prose>
            </div>

            <ModelCompare r={r} />

            <div className="mt-6 max-w-prose space-y-4">
              <Callout tone="warn" title="The bottom bar is the one to look at">
                That is the same network trained on pictures with the brain rubbed out, leaving
                only the skull rim and the background. There is no information about dementia
                in those images. It should score near guessing. It does not.
                {r.shortcut_probe?.margin_over_probe != null && (
                  <> The best real model beats it by{" "}
                  {(r.shortcut_probe.margin_over_probe * 100).toFixed(1)} percentage points,
                  which is not much of a gap to hang a diagnosis on.</>)}
              </Callout>

              <Prose>
                <p>
                  Head size, skull thickness and the shape of the scalp all change with age, and
                  age is the strongest risk factor for dementia there is. So a model can pick up
                  a real correlation without ever looking at brain tissue. That is not cheating
                  by the model. It is a gap in what the labels can tell it apart from.
                </p>
                <p>
                  The other surprise is the top bar. A small network trained from scratch beats
                  a ResNet-18 that had already learned from millions of photographs, on every
                  measure here. Pretraining on photographs is usually treated as free
                  improvement. On 242 people of grey medical images, it was not.
                </p>
              </Prose>
            </div>
          </Section>

          <Section n="3" title="Where the mistakes go">
            <ConfusionMatrix
              slice={run.slice_level.confusion_matrix}
              subject={run.subject_level.confusion_matrix}
            />
            <div className="mt-6 max-w-prose">
              <Prose>
                <p>
                  Look along the diagonal. The healthy group is handled well. The very mild
                  group gets split roughly down the middle. The mild group is missed almost
                  entirely, and the single moderate patient is missed too.
                </p>
                <p>
                  That pattern is what you would expect from a model that has learned roughly
                  one thing: whether the fluid spaces in the middle of the brain look wider
                  than usual. That separates clearly ill from clearly well. It does not
                  separate mild from very mild.
                </p>
              </Prose>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {run.subject_level.per_class.map((pc, i) => (
                <div key={i} className="border-t border-rule pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[0.9375rem] text-ink">{SHORT[i]}</span>
                    <span className="tnum text-[0.875rem] text-muted">
                      {pc.support ? `${Math.round(pc.recall * 100)}% found` : "none in test set"}
                    </span>
                  </div>
                  <p className="mt-1 p-small">
                    {pc.support} patient{pc.support === 1 ? "" : "s"} in the test set
                    {pc.support > 0 && pc.support <= 3
                      ? ". Too few to draw any conclusion from."
                      : "."}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section n="4" title="The question it can actually answer">
            <RocCurve
              points={run.roc_subject ?? []}
              auc={run.subject_level.binary_screening.roc_auc}
              n={run.subject_level.n}
            />
            <div className="mt-6 max-w-prose">
              <Prose>
                <p>
                  This is the same model, asked an easier question: does this person have any
                  dementia at all? Each dot is a different cut-off for how confident the model
                  has to be before it says yes. Move up the curve and it catches more illness
                  but wrongly flags more healthy people.
                </p>
                <p>
                  For comparison, a careful published study using a much larger pool of scans
                  from two collections reached about 90 percent balanced accuracy on healthy
                  versus Alzheimer&apos;s, and only about 62 percent on a three-way split with
                  mild cognitive impairment in the middle<sup className="font-mono text-[0.7rem]">
                  <Link href="/references#r6" className="text-steel no-underline">[6]</Link></sup>.
                  The three-way number is the one worth remembering. Even with far more data,
                  sorting the middle of the scale is hard.
                </p>
              </Prose>
            </div>
          </Section>

          <Section n="5" title="Letting the model say it does not know">
            <CoverageSlider
              points={run.abstention_subject.map((a) => ({
                coverage: a.coverage, accuracy: a.accuracy, min_confidence: a.min_confidence,
              }))}
              total={run.subject_level.n}
            />
            <div className="mt-6 max-w-prose">
              <Prose>
                <p>
                  A model that answers every case is not much use if some of those answers are
                  coin flips. A more sensible setup is to let it hand the hard cases to a
                  person. Drag the slider and you can see the trade: keep fewer patients and
                  the ones it does rule on get more reliable.
                </p>
                <p>
                  These confidences have been corrected on a separate set of patients first,
                  using a single scaling number ({fmt(run.calibration.temperature, 2)}). Without
                  that step the model is overconfident and the slider would be misleading.
                </p>
              </Prose>
            </div>
          </Section>

          {run.accuracy_by_slice && run.accuracy_by_slice.length > 5 && (
            <Section n="6" title="Not every slice is equally useful">
              <SliceAccuracy points={run.accuracy_by_slice.map((p) => ({
                slice: p.slice, accuracy: p.accuracy, n: p.n,
              }))} />
              <div className="mt-6 max-w-prose">
                <Prose>
                  <p>
                    Each scan was cut into 61 slices. The lowest ones pass through the eyes and
                    the base of the skull, where there is not much brain to look at. The higher
                    ones pass through the fluid spaces that widen as tissue is lost. If the
                    model were reading anatomy, the middle and upper slices should carry more
                    signal, and that is roughly what shows up.
                  </p>
                </Prose>
              </div>
            </Section>
          )}

          {r.cam_ventricle_overlap && (
            <Section n="7" title="Is it looking at the right thing?">
              <div className="max-w-prose">
                <Prose>
                  <p>
                    The video that started this project said to check the work with a Dice
                    score and intersection over union. Those measure how much two shapes
                    overlap. A model that outputs four numbers has no shape, so there is
                    nothing to overlap and the measures do not apply.
                  </p>
                  <p>
                    There is a shape question worth asking though. As brain tissue is lost,
                    the fluid-filled chambers in the middle of the brain get wider. That is the
                    classic sign on a scan. So I marked those chambers on each slice, took the
                    region the model leaned on hardest, made the two the same size, and
                    measured the overlap properly.
                  </p>
                </Prose>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Stat tone="steel"
                      value={fmt(r.cam_ventricle_overlap.trained_model.dice, 3)}
                      label="Trained model" note="overlap with the fluid chambers" />
                <Stat value={fmt(r.cam_ventricle_overlap.control_centred_blob.dice, 3)}
                      label="A plain circle in the middle" note="same size, no thought involved" />
                <Stat value={fmt(r.cam_ventricle_overlap.control_untrained_cnn.dice, 3)}
                      label="An untrained network" note="same shape, random weights" />
              </div>

              <div className="mt-6 max-w-prose">
                <Callout
                  tone={
                    r.cam_ventricle_overlap.trained_model.dice >
                    Math.max(r.cam_ventricle_overlap.control_centred_blob.dice,
                             r.cam_ventricle_overlap.control_untrained_cnn.dice)
                      ? "good" : "warn"
                  }
                >
                  {r.cam_ventricle_overlap.verdict}
                </Callout>
                <p className="mt-4 p-body">
                  The two comparison numbers are the important part. In a picture of a head
                  that has been centred, almost any blob near the middle will overlap the
                  fluid chambers a bit. Without something to compare against, a score of 0.4
                  would mean nothing at all.
                </p>
              </div>

              <div className="mt-6">
                <Figure
                  src="/figures/cam_ventricles.png"
                  alt="For each stage: the slice, the marked fluid chambers, the region the model leaned on, and the two drawn on top of each other."
                  caption="Left to right: the slice, the fluid chambers I marked, the region the model leaned on at matching size, and the two overlaid. Red is the model, green is the chambers, yellow is where they agree."
                />
              </div>
            </Section>
          )}

          {r.shortcut_probe && (
            <Section n="8" title="A closer look at the brain-removed check">
              <div className="max-w-prose">
                <Prose>
                  <p>
                    Networks are good at finding shortcuts. If something outside the brain
                    happened to line up with the labels, like head size or a quirk of the
                    scanner, the model could score well without looking at any anatomy.
                  </p>
                  <p>
                    So I rubbed the brain out of every picture, leaving only the skull rim and
                    the background, and trained the whole thing again. There is nothing about
                    dementia left in those images. If the score stayed high, everything else on
                    this page would be suspect.
                  </p>
                </Prose>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat tone="brick"
                      value={fmt(r.shortcut_probe.subject_level_balanced_accuracy)}
                      label="Score with the brain erased" />
                <Stat value={r.shortcut_probe.chance_level.toFixed(2)}
                      label="Score from pure guessing" />
                <Stat value={fmt(r.shortcut_probe.best_real_model_balanced_accuracy)}
                      label="Best model that can see the brain" />
                <Stat tone="brick"
                      value={r.shortcut_probe.margin_over_probe != null
                        ? `+${(r.shortcut_probe.margin_over_probe * 100).toFixed(1)} pts`
                        : "n/a"}
                      label="All the brain is worth, on this data" />
              </div>
              <div className="mt-6 max-w-prose">
                <Callout tone="warn">{r.shortcut_probe.verdict}</Callout>
                <p className="mt-4 p-body">
                  I had originally written this check to pass if the brain-removed score sat
                  below guessing plus fifteen points, and by that rule it passed. The rule was
                  wrong. What matters is not the distance from guessing, it is the distance from
                  the real model, and that distance turned out to be small. Comparing against a
                  round number I picked myself would have let me report a clean pass for
                  something that is not clean.
                </p>
              </div>
            </Section>
          )}

          {r.ventricle_baseline && (
            <Section n="9" title="Does the network beat a ruler?">
              <div className="max-w-prose">
                <Prose>
                  <p>
                    A network is only worth the trouble if it beats the obvious thing. The
                    obvious thing here is measuring the fluid chambers and dividing by brain
                    size, then fitting a plain statistical model to that and seven other simple
                    measurements. Same patients, same split.
                  </p>
                </Prose>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Stat tone="steel" value={fmt(run.subject_level.balanced_accuracy)}
                      label="Convolutional network" note="11 million numbers to fit" />
                <Stat value={fmt(r.ventricle_baseline.subject_level.balanced_accuracy)}
                      label="Eight measurements and a plain fit" note="the ruler" />
              </div>
              <p className="mt-6 max-w-prose p-body">
                {run.subject_level.balanced_accuracy >
                 r.ventricle_baseline.subject_level.balanced_accuracy + 0.03
                  ? "The network is clearly ahead, so it is picking up more than chamber size alone."
                  : "The network does not clearly beat the simple measurements. On a dataset this small, the extra machinery is not obviously paying for itself, and that is worth saying out loud."}
              </p>
            </Section>
          )}

          <Section n="10" title="What would have to change for this to be worth anything">
            <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
              {[
                ["347 people is a small study.",
                 "Splitting by person leaves about 53 patients to test on. Every number on this page has a wide margin of error around it, and I would not be surprised if a different split moved things by several points."],
                ["One group has two people in it.",
                 "The moderate dementia group cannot be learned from or tested on. It is in the charts because leaving it out would hide the problem rather than fix it."],
                ["One scanner, one site, one moment.",
                 "These scans were all collected the same way at the same place. Nothing here shows the model would survive a different machine or a different population."],
                ["The labels are a clinician's judgement.",
                 "Clinical Dementia Rating comes from an interview, not from looking inside the brain after death. The best the model can do is copy that judgement, including wherever it is wrong."],
                ["One flat slice is not how anyone reads a scan.",
                 "A radiologist looks at the whole volume, plus history and cognitive tests. Throwing all of that away and keeping one cross-section discards most of the evidence."],
                ["Most patients here are healthy.",
                 "About 78 percent of the pictures are from people with no dementia. Answering healthy every time scores 78 percent. That is why the balanced numbers lead this page."],
              ].map(([t, d]) => (
                <div key={t}>
                  <p className="font-serif text-[1.0625rem] text-ink">{t}</p>
                  <p className="mt-1.5 p-body">{d}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </Page>
  );
}
