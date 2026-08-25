"use client";

import Link from "next/link";
import { useResults } from "@/lib/useResults";
import { Callout, Figure, Page, Prose, Ref, Section, Stat } from "@/components/ui";
import { Loading, LoadError } from "@/components/Loading";
import LeakageBars from "@/components/charts/LeakageBars";
import DatasetBars from "@/components/charts/DatasetBars";

export default function Home() {
  const { data: r, error } = useResults();

  const lk = r?.leakage_experiment;
  const primary = r?.primary_run ? r.runs[r.primary_run] : undefined;
  const sub = primary?.subject_level;

  return (
    <Page
      eyebrow="A weekend project that did not go as planned"
      title="I tried to read Alzheimer's stage from a brain scan. Most of my accuracy was fake."
      lede="A short video said you could build this in a weekend: grab 86,000 brain MRI images, train a network, report your score. I did that. The score was 99 percent. Then I checked where the images came from, and almost all of that number fell apart."
    >
      {error && <div className="py-8"><LoadError /></div>}
      {!r && !error && <Loading />}

      {r && (
        <>
          <Section n="1" id="short" title="The short version">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Prose>
                <p>
                  The dataset holds 86,437 pictures. That sounds like plenty. But those
                  pictures come from only 347 people. Each person was scanned four times, and
                  each scan was cut into 61 thin slices going up through the head. So one
                  person turns into about 244 pictures that all look nearly the same.
                </p>
                <p>
                  If you shuffle those pictures at random and put some in a training pile and
                  some in a testing pile, slice 119 of a head ends up in one pile and slice 120
                  of the same head ends up in the other. They are almost the same picture. The
                  network does not have to learn anything about dementia. It can just learn to
                  recognise the person and remember what their label was.
                </p>
                <p>
                  I trained the same network twice to see how much this mattered. Same shape,
                  same settings, same number of passes over the data, same random seed. The
                  only difference was how I split the pile.
                </p>
              </Prose>

              <aside className="grid gap-6 self-start sm:grid-cols-2 lg:grid-cols-1">
                {lk && (
                  <>
                    <Stat
                      tone="brick"
                      value={`${(lk.leaky_random_split.balanced_accuracy * 100).toFixed(1)}%`}
                      label="Score when I split the pictures at random"
                      note="every one of the 347 people appears on both sides"
                    />
                    <Stat
                      tone="steel"
                      value={`${(lk.honest_subject_split_slice_level.balanced_accuracy * 100).toFixed(1)}%`}
                      label="Score for the same model, split by person instead"
                      note="random guessing would score 25 percent"
                    />
                  </>
                )}
                <Stat
                  value={`${r.dataset.total_subjects}`}
                  label="People in the dataset"
                  note={`not ${r.dataset.total_images.toLocaleString()} independent samples`}
                />
              </aside>
            </div>

            <div className="mt-8">
              <LeakageBars r={r} />
            </div>

            <div className="mt-6 max-w-prose">
              <Callout tone="warn" title="Why the two bars differ so much">
                Plain accuracy only drops a bit, because most patients in this dataset are
                healthy and guessing healthy is often right. Balanced accuracy treats all four
                stages as equally important, and it falls off a cliff. That gap is the whole
                story. A model can look fine on one number while being close to useless on
                the other.
              </Callout>
            </div>
          </Section>

          <Section n="2" id="notmine" title="This is not a new idea, and that is the point">
            <Prose>
              <p>
                I did not discover this. Yagis and colleagues ran the same test in 2021 and
                found that splitting by slice instead of by patient lifted accuracy by about
                30 points on this same OASIS collection<Ref n={2} />. They also did something
                sharper: they shuffled the labels so the pictures meant nothing, then trained
                on them. Splitting by slice still gave about 96 percent. Splitting by patient
                gave 50 percent, which is what you should get from noise.
              </p>
              <p>
                The same problem shows up in brain wave recordings<Ref n={3} /> and in eye
                scans<Ref n={4} />. It keeps happening because the mistake is invisible. The
                code runs. The loss goes down. The score is high. Nothing warns you.
              </p>
              <p>
                My number came out at{" "}
                {lk ? `${lk.inflation.accuracy_points} points of plain accuracy and about ${lk.inflation.balanced_accuracy_points} points of balanced accuracy` : "a large gap"}.
                That lines up with what they reported, which is reassuring, because it means
                the effect is real and not something odd about my code.
              </p>
            </Prose>
          </Section>

          <Section n="3" id="data" title="What is actually in the folder">
            <div className="max-w-prose">
              <Prose>
                <p>
                  The pictures come from OASIS, an open collection of brain scans released by
                  Washington University<Ref n={1} />. Each person has a Clinical Dementia
                  Rating, which is a score a clinician gives after talking to the patient and
                  someone who knows them. Zero means no dementia. Half means very mild. One
                  means mild. Two means moderate.
                </p>
                <p>
                  Switch the chart below between counting files and counting people. The
                  second view is the one that matters.
                </p>
              </Prose>
            </div>
            <div className="mt-6">
              <DatasetBars r={r} />
            </div>
            <div className="mt-6 max-w-prose">
              <Callout tone="warn" title="The moderate group has two people in it">
                Not two hundred. Two. There is no split, no amount of flipping and rotating
                images, and no clever training trick that turns two people into a group you
                can learn from or test on. Every number I report for that stage describes one
                or two individuals, and I have flagged it wherever it appears.
              </Callout>
            </div>
          </Section>

          <Section n="4" id="works" title="So does anything work?">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Prose>
                <p>
                  Yes, but a smaller thing than I set out to do. Telling four stages apart is
                  close to hopeless with this much data. Telling <em>any</em> dementia from{" "}
                  <em>no</em> dementia works reasonably well.
                </p>
                <p>
                  When I average the model&apos;s answer across all of a patient&apos;s slices
                  and ask only that yes or no question, it gets an area under the curve of{" "}
                  {sub ? sub.binary_screening.roc_auc?.toFixed(2) ?? "n/a" : "n/a"}. That is a real
                  signal. It is also the honest ceiling of what one flat slice of a head can
                  tell you.
                </p>
                <p>
                  The <Link href="/results" className="link">results page</Link> has the full
                  picture, including where it fails and what it would take to trust it.
                </p>
              </Prose>

              {sub && (
                <aside className="grid gap-6 self-start sm:grid-cols-2 lg:grid-cols-1">
                  <Stat tone="forest"
                        value={sub.binary_screening.roc_auc?.toFixed(3) ?? "n/a"}
                        label="Dementia or not, judged per patient"
                        note="1.0 would be perfect, 0.5 would be a coin flip" />
                  <Stat value={sub.quadratic_kappa.toFixed(3)}
                        label="Agreement with the clinician across all four stages"
                        note="counts a near miss as better than a wild miss" />
                </aside>
              )}
            </div>
          </Section>

          <Section n="5" id="try" title="Try it on a scan">
            <div className="max-w-prose">
              <Prose>
                <p>
                  The model runs inside your browser. Nothing you open gets sent to a server,
                  because there is no server. You can drop in one of the scans from the
                  dataset and watch it work, and see which parts of the slice it leaned on.
                </p>
              </Prose>
              <p className="mt-6">
                <Link href="/try"
                      className="inline-block bg-ink px-5 py-2.5 text-[0.9375rem] text-white hover:bg-steel">
                  Open the demo
                </Link>
              </p>
            </div>
          </Section>

          <Section n="6" id="pipeline" title="What the pictures look like before the model sees them">
            <div className="max-w-prose">
              <Prose>
                <p>
                  Every file in this dataset is 496 pixels wide and 248 tall. That is a square
                  slice that has been stretched to twice its width somewhere along the way.
                  Feed that straight into a network and you are training it on squashed heads.
                  Putting the shape back is the first thing I do.
                </p>
                <p>
                  After that I find the head, crop a square box around it, and even out the
                  brightness so a dim scan and a bright scan look alike.
                </p>
              </Prose>
            </div>
            <div className="mt-6">
              <Figure
                src="/figures/preprocessing_probe.png"
                alt="Four steps applied to eight brain scans: the raw wide file, the same slice with its shape restored, the detected head box, and the final square image."
                caption="Each row is one scan going through the four steps. The brains get noticeably rounder once the stretch is undone."
              />
            </div>
            <p className="mt-6 max-w-prose p-body">
              The <Link href="/method" className="link">method page</Link> covers this in more
              detail, including a mistake I made here that quietly ruined some of the images
              until I looked at them.
            </p>
          </Section>
        </>
      )}
    </Page>
  );
}
