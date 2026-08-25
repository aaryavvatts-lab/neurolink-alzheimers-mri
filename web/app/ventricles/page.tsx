"use client";
import Link from "next/link";
import { results as r } from "@/lib/results";
import VentricleTool from "@/components/VentricleTool";
import { Callout, Page, Prose, Section, Stat } from "@/components/ui";
import { fmt } from "@/lib/types";

export default function VentriclesPage() {
  const base = r.ventricle_baseline;
  const run = r.primary_run ? r.runs[r.primary_run] : undefined;

  return (
    <Page
      eyebrow="Tool 03"
      title="Measure the fluid spaces yourself"
      lede="Before reaching for a neural network it is worth seeing how far a ruler gets you. The classic sign of Alzheimer's on a scan is that the fluid chambers in the middle of the brain get wider as the tissue around them is lost."
    >
      <Section n="1" title="The measuring tool">
        <div className="mb-8 max-w-prose">
          <Prose>
            <p>
              Pick two patients and move the sliders. The tool marks every dark pixel that sits
              well inside the brain and near the middle, then works out how much of the brain
              those pixels cover. Red is what it counted.
            </p>
            <p>
              Try a healthy patient against a moderate one at a slice around halfway up. Then try
              the same pair near the bottom of the stack and watch the difference disappear.
            </p>
          </Prose>
        </div>

        <VentricleTool />
      </Section>

      <Section n="2" title="How well does the ruler actually do?">
        <div className="max-w-prose">
          <Prose>
            <p>
              I took eight simple measurements of this kind, chiefly the fluid-to-brain area
              ratio, and fitted a plain statistical model to them. Same patients, same split as
              the network.
            </p>
          </Prose>
        </div>

        {base && run && (
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <Stat value={fmt(run.subject_level.balanced_accuracy)}
                  label="Neural network, four stages" tone="steel" />
            <Stat value={fmt(base.subject_level.balanced_accuracy)}
                  label="Eight measurements and a plain fit" />
            <Stat value={fmt(run.subject_level.binary_screening.roc_auc)}
                  label="Network, dementia or not" tone="steel" />
            <Stat value={fmt(base.subject_level.binary_screening.roc_auc)}
                  label="Ruler, dementia or not" />
          </div>
        )}

        <div className="mt-6 max-w-prose">
          <Callout title="The ruler is closer than it should be">
            Eight numbers you could measure with a threshold and some arithmetic get within a few
            points of a network with millions of parameters on the four-stage task. The network
            does pull clearly ahead on the simpler question of whether there is any dementia at
            all, which is the honest summary: the extra machinery buys something, but less than
            you would hope for the complexity.
          </Callout>
        </div>

        <p className="mt-6 max-w-prose p-body">
          The full comparison, including a control where the brain is erased entirely, is on the{" "}
          <Link href="/findings" className="link">findings page</Link>.
        </p>
      </Section>

      <Section n="3" title="What this measurement is not">
        <div className="max-w-prose">
          <Prose>
            <p>
              This is a rough proxy, not a clinical measurement. Proper volumetric work segments
              the ventricles in three dimensions using software built for the job, corrects for
              head size, and compares against age-matched norms. What happens here is a threshold
              and a circle.
            </p>
            <p>
              It is good enough to ask whether the model is looking somewhere sensible, and to
              show that the signal in these scans is real and visible to the eye. It is not good
              enough to put a number on anyone.
            </p>
          </Prose>
        </div>
      </Section>
    </Page>
  );
}
