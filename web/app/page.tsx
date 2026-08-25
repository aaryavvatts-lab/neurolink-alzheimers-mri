"use client";

import Link from "next/link";
import { results as r } from "@/lib/results";
import { TOOLS } from "@/lib/nav";
import { fmt } from "@/lib/types";
import { Callout, Prose, Ref, Section, Stat } from "@/components/ui";
import LeakageBars from "@/components/charts/LeakageBars";

export default function Home() {
  const lk = r.leakage_experiment;
  const probe = r.shortcut_probe;
  const run = r.primary_run ? r.runs[r.primary_run] : undefined;
  const d = r.dataset;

  return (
    <div className="mx-auto max-w-wide px-5">
      {/* ---------------- hero ---------------- */}
      <header className="border-b border-rule py-14 sm:py-20">
        <p className="mb-4 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-muted">
          A weekend project that did not go as planned
        </p>
        <h1 className="max-w-4xl text-[2.1rem] font-semibold leading-[1.12] sm:text-[3.1rem]">
          I tried to read Alzheimer&apos;s stage from a brain scan.
          <br className="hidden sm:block" />
          <span className="text-brick"> Most of my accuracy was fake.</span>
        </h1>
        <p className="p-lede mt-6 max-w-2xl">
          A short video said you could build this in a weekend. Grab 86,000 brain MRI images,
          train a network, report your score. I did that, and the score was 99 percent. Then I
          checked where the images came from, and almost all of that number fell apart.
        </p>

        <div className="mt-10 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-5">
          {lk && (
            <Stat tone="brick"
                  value={`${(lk.leaky_random_split.balanced_accuracy * 100).toFixed(1)}%`}
                  label="Score when the pictures are split at random"
                  note="what the tutorial version reports" />
          )}
          {lk && (
            <Stat tone="steel"
                  value={`${(lk.honest_subject_split_slice_level.balanced_accuracy * 100).toFixed(1)}%`}
                  label="Same model, split by patient instead"
                  note="guessing scores 25%" />
          )}
          <Stat value={`${d.total_subjects}`}
                label="People the data actually contains"
                note={`not ${d.total_images.toLocaleString()} samples`} />
          {probe && (
            <Stat tone="brick"
                  value={probe.margin_over_probe != null
                    ? `+${(probe.margin_over_probe * 100).toFixed(1)}`
                    : "n/a"}
                  label="Points the entire brain was worth"
                  note="against a control with the brain erased" />
          )}
          {run && (
            <Stat tone="forest" value={fmt(run.subject_level.binary_screening.roc_auc, 2)}
                  label="Dementia or not, per patient"
                  note="the one thing that does work" />
          )}
        </div>
      </header>

      {/* ---------------- what this is ---------------- */}
      <Section n="1" id="what" title="What this is">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Prose>
            <p>
              A convolutional network that reads one flat slice of a brain scan and guesses which
              of four dementia stages the person is at. It runs in your browser, on your machine,
              and nothing you open is uploaded anywhere.
            </p>
            <p>
              The model is the least interesting part. What this site is really about is the gap
              between how well it appears to work and how well it does, and how easy it turned
              out to be to end up on the wrong side of that gap without any warning.
            </p>
            <p>
              Every number here is measured, every claim that came from somewhere else is cited,
              and the results that made the project look worse are the ones on the front page.
            </p>
          </Prose>
          <div className="space-y-4">
            <Callout title="The one-line version">
              86,437 pictures came from 347 people. Split the pictures instead of the people and
              every one of those 347 lands in both the training and the test set, so the network
              can score brilliantly by recognising faces it has already seen.
            </Callout>
            <Callout tone="warn" title="Not a medical tool">
              A student project. No regulator has looked at it, no clinician has tested it, and
              it should not inform anything about a real person.
            </Callout>
          </div>
        </div>
      </Section>

      {/* ---------------- findings ---------------- */}
      <Section n="2" id="findings" title="Three things worth knowing">
        <div className="space-y-10">
          {[
            {
              n: "01",
              title: "Nearly all the accuracy came from the split, not the model",
              body: (
                <>
                  <p>
                    I trained the same network twice, identical in every way except whether the
                    train and test piles were divided by picture or by patient. Balanced accuracy
                    went from about 99 percent to about 34, which is barely above guessing.
                  </p>
                  <p>
                    Yagis and colleagues measured roughly the same thing on this dataset in 2021,
                    and showed a picture-level split still reports 96 percent even when the labels
                    are shuffled into nonsense<Ref n={2} />.
                  </p>
                </>
              ),
              href: "/split",
              cta: "Try the split simulator",
            },
            {
              n: "02",
              title: "Erasing the brain barely hurt it",
              body: (
                <>
                  <p>
                    I rubbed the brain out of every image, leaving skull and background, and
                    trained again. There is nothing about dementia left in those pictures. It
                    scored{" "}
                    {probe ? fmt(probe.subject_level_balanced_accuracy) : "well above chance"}{" "}
                    against 0.25 for guessing, and the best real model beat it by only{" "}
                    {probe?.margin_over_probe != null
                      ? `${(probe.margin_over_probe * 100).toFixed(1)} points`
                      : "a little"}.
                  </p>
                  <p>
                    Head size and skull shape change with age, and age drives dementia risk, so a
                    model can ride that correlation without reading any tissue at all.
                  </p>
                </>
              ),
              href: "/findings#probe",
              cta: "Read how the control was built",
            },
            {
              n: "03",
              title: "The small network beat the big pretrained one",
              body: (
                <>
                  <p>
                    Starting from a ResNet-18 that already knows about photographs is the standard
                    move and is usually assumed to help. A plain network with a fifth of the
                    parameters, trained from nothing, won on every measure here.
                  </p>
                  <p>
                    With 242 people to learn from, the larger model mostly had more room to
                    memorise. It also made the demo five times smaller to download.
                  </p>
                </>
              ),
              href: "/findings#pretraining",
              cta: "See all four approaches compared",
            },
          ].map((f) => (
            <article key={f.n} className="grid gap-5 border-t border-rule pt-7 md:grid-cols-[3rem_minmax(0,1fr)]">
              <p className="font-mono text-[1.5rem] leading-none text-rule">{f.n}</p>
              <div>
                <h3 className="font-serif text-[1.3rem] leading-snug text-ink">{f.title}</h3>
                <div className="prose-col mt-3 space-y-3 [&>p]:p-body">{f.body}</div>
                <p className="mt-4">
                  <Link href={f.href} className="link text-[0.875rem]">{f.cta}</Link>
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10">
          <LeakageBars r={r} />
        </div>
      </Section>

      {/* ---------------- tools ---------------- */}
      <Section n="3" id="tools" title="Six things you can actually do here">
        <div className="max-w-prose">
          <Prose>
            <p>
              All of these run on your own machine. There is no server behind this site, so
              nothing you open, drop in or paste is sent anywhere.
            </p>
          </Prose>
        </div>

        <ul className="mt-8 divide-y divide-rule border-y border-rule">
          {TOOLS.map(([href, name, desc], i) => (
            <li key={href}>
              <Link href={href}
                    className="group grid gap-4 py-6 transition-colors hover:bg-white md:grid-cols-[3.5rem_minmax(0,18rem)_minmax(0,1fr)_5rem] md:items-baseline md:px-3">
                <span className="font-mono text-[0.875rem] text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-serif text-[1.2rem] text-ink">{name}</span>
                <span className="p-body">{desc}</span>
                <span className="text-[0.8125rem] text-steel group-hover:underline md:text-right">
                  Open
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6 max-w-prose">
          <Callout title="The last one is the useful one">
            The first five are about this project. The checker is not. The mistake this whole
            site is about is not specific to brain scans, and it works on any list of file names,
            so if you take one thing away from here, take that.
          </Callout>
        </div>
      </Section>

      {/* ---------------- data ---------------- */}
      <Section n="4" id="data" title="Where the data came from">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Prose>
            <p>
              The scans come from OASIS, an open collection released by Washington University in
              St. Louis<Ref n={1} />. Each person carries a Clinical Dementia Rating, a score a
              clinician assigns after interviewing the patient and someone close to them. Zero is
              no dementia, half is very mild, one is mild, two is moderate.
            </p>
            <p>
              Each person was scanned four times, and each scan was cut into 61 slices going up
              through the head. That is where 347 people become 86,437 files, and it is the whole
              reason a careless split does so much damage.
            </p>
            <p>
              One of the four groups has two people in it. Not two hundred. Two.
            </p>
          </Prose>
          <aside className="space-y-5">
            {d.classes.map((c) => (
              <div key={c.name} className="flex items-baseline justify-between border-b border-rule pb-2">
                <div>
                  <p className="text-[0.9375rem] text-ink">{c.short}</p>
                  <p className="text-[0.75rem] text-muted">CDR {c.cdr}</p>
                </div>
                <div className="text-right">
                  <p className={`tnum font-serif text-[1.25rem] ${c.subjects <= 3 ? "text-brick" : "text-ink"}`}>
                    {c.subjects}
                  </p>
                  <p className="text-[0.75rem] text-muted">people</p>
                </div>
              </div>
            ))}
            <p className="text-[0.8125rem]">
              <Link href="/data" className="link">More on the dataset</Link>
            </p>
          </aside>
        </div>
      </Section>

      {/* ---------------- what works ---------------- */}
      <Section n="5" id="works" title="So does anything work?">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Prose>
            <p>
              Yes, but something smaller than I set out to do. Sorting patients into four stages
              is close to hopeless with this much data. Separating people with any dementia from
              people with none works reasonably well.
            </p>
            <p>
              Averaging the model&apos;s answer across all of a patient&apos;s slices and asking
              only that yes or no question gives an area under the curve of{" "}
              {run ? fmt(run.subject_level.binary_screening.roc_auc, 2) : "about 0.94"}. That is a
              real signal, and it is roughly the ceiling of what one flat slice of a head can
              tell you.
            </p>
            <p>
              For comparison, a careful study using two much larger collections reached about 90
              percent balanced accuracy on healthy versus Alzheimer&apos;s, and about 62 percent
              once a middle group was added<Ref n={6} />. The middle of the scale is where this
              gets hard for everyone.
            </p>
          </Prose>
          {run && (
            <aside className="grid gap-5 self-start sm:grid-cols-2 lg:grid-cols-1">
              <Stat tone="forest" value={fmt(run.subject_level.binary_screening.roc_auc)}
                    label="Dementia or not, judged per patient"
                    note="1.0 perfect, 0.5 a coin flip" />
              <Stat value={fmt(run.subject_level.quadratic_kappa)}
                    label="Agreement with the clinician across four stages"
                    note="counts a near miss better than a wild one" />
              <p className="text-[0.8125rem]">
                <Link href="/results" className="link">All the numbers</Link>
              </p>
            </aside>
          )}
        </div>
      </Section>
    </div>
  );
}
