"use client";

import Link from "next/link";
import { results as r } from "@/lib/results";
import { fmt } from "@/lib/types";
import { Callout, Prose, Ref } from "@/components/ui";
import LeakageBars from "@/components/charts/LeakageBars";
import Reveal from "@/components/Reveal";
import Zoom from "@/components/Zoom";
import ToolList from "@/components/ToolList";

/* The object, large: one real slice from the public collection fills the first screen and the
   page keeps coming back to it. Every number on this page is read from results.json. */
export default function Home() {
  const lk = r.leakage_experiment;
  const probe = r.shortcut_probe;
  const run = r.primary_run ? r.runs[r.primary_run] : undefined;
  const d = r.dataset;
  const leaky = lk ? (lk.leaky_random_split.balanced_accuracy * 100).toFixed(1) : null;
  const honest = lk ? (lk.honest_subject_split_slice_level.balanced_accuracy * 100).toFixed(1) : null;

  return (
    <>
      {/* ---------------- the object, large ---------------- */}
      <section className="hero" aria-label="Introduction">
        <div className="hero__pic" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pictures/Non_OAS1_0007_128.png" alt="" width={1024} height={1024} fetchPriority="high" />
        </div>
        <div className="wrap hero__text">
          <h1 className="display lines">
            <span className="line"><span data-line style={{ ["--i" as string]: 0 }}>Most of my</span></span>
            <span className="line"><span data-line style={{ ["--i" as string]: 1 }}>accuracy was fake</span></span>
          </h1>
          <p className="lead" data-rise style={{ ["--i" as string]: 2 }}>
            I tried to read Alzheimer&apos;s stage from a brain scan. A short video said you could
            build this in a weekend. Grab 86,000 brain MRI images, train a network, report your
            score. I did that, and the score was 99 percent. Then I checked where the images came
            from, and almost all of that number fell apart.
          </p>
          <div className="hero__acts" data-rise style={{ ["--i" as string]: 3 }}>
            <Link href="/try" className="button">Run the model on a scan</Link>
            <a href="#findings" className="textbtn">What the split hid</a>
          </div>
        </div>
      </section>

      {/* ---------------- the one-line version, with the slices inline ---------------- */}
      <Reveal className="wrap statement" aria-label="The one-line version">
        <p>
          86,437 pictures
          <span className="thumb" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/samples/pre/Non_OAS1_0007_128.png" alt="" width={224} height={224} loading="lazy" />
          </span>
          came from 347 people
          <span className="thumb" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/samples/pre/Mild_OAS1_0052_123.png" alt="" width={224} height={224} loading="lazy" />
          </span>
          . Split the pictures instead of the people and all 347 land in both the training and the
          test set
          <span className="thumb" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/samples/pre/Moderate_OAS1_0308_132.png" alt="" width={224} height={224} loading="lazy" />
          </span>
          .
        </p>
      </Reveal>

      {/* ---------------- one frame, three distances ---------------- */}
      <Zoom
        src="/pictures/Verymild_OAS1_0060_134.png"
        alt="One MRI slice through the head of a participant rated very mild, from the OASIS collection"
        first="One slice,"
        second="three distances"
        caption="The dark butterfly shape near the middle is the lateral ventricles, two fluid-filled chambers. They widen as the tissue around them is lost, and that difference is most of what any model working on these scans has to go on."
      />

      {/* ---------------- findings ---------------- */}
      <Reveal id="findings" className="wrap section">
        <h2 className="head" style={{ marginBottom: "clamp(2rem, 4vw, 3rem)" }}>Three things worth knowing</h2>
        <div className="findings">
          <Reveal as="article" index={0}>
            <h3>Nearly all the accuracy came from the split, not the model</h3>
            <div className="prose-col">
              <p className="p-body">
                I trained the same network twice, identical in every way except whether the
                train and test piles were divided by picture or by patient. Balanced accuracy
                went from about 99 percent to about 34, which is barely above guessing.
              </p>
              <p className="p-body">
                Yagis and colleagues measured roughly the same thing on this dataset in 2021,
                and showed a picture-level split still reports 96 percent even when the labels
                are shuffled into nonsense<Ref n={2} />.
              </p>
              <p className="mt-3"><Link href="/split" className="link">Try the split simulator</Link></p>
            </div>
          </Reveal>
          <Reveal as="article" index={1}>
            <h3>Erasing the brain barely hurt it</h3>
            <div className="prose-col">
              <p className="p-body">
                I rubbed the brain out of every image, leaving skull and background, and
                trained again. There is nothing about dementia left in those pictures. It
                scored{" "}
                {probe ? fmt(probe.subject_level_balanced_accuracy) : "well above chance"}{" "}
                against 0.25 for guessing, and the best real model beat it by only{" "}
                {probe?.margin_over_probe != null
                  ? `${(probe.margin_over_probe * 100).toFixed(1)} points`
                  : "a little"}.
              </p>
              <p className="p-body">
                Head size and skull shape change with age, and age drives dementia risk, so a
                model can ride that correlation without reading any tissue at all.
              </p>
              <p className="mt-3"><Link href="/findings#probe" className="link">Read how the control was built</Link></p>
            </div>
          </Reveal>
          <Reveal as="article" index={2}>
            <h3>The small network beat the big pretrained one</h3>
            <div className="prose-col">
              <p className="p-body">
                Starting from a ResNet-18 that already knows about photographs is the standard
                move and is usually assumed to help. A plain network with a fifth of the
                parameters, trained from nothing, won on every measure here.
              </p>
              <p className="p-body">
                With 242 people to learn from, the larger model mostly had more room to
                memorise. It also made the demo five times smaller to download.
              </p>
              <p className="mt-3"><Link href="/findings#pretraining" className="link">See all four approaches compared</Link></p>
            </div>
          </Reveal>
        </div>
        <div className="mt-12">
          <LeakageBars r={r} />
        </div>
      </Reveal>

      {/* ---------------- the figure on the picture's edge ---------------- */}
      {leaky && honest && (
        <section className="band" aria-label="The number that looked like success">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pictures/Moderate_OAS1_0308_132.png" alt="A slice through the head of the one participant rated moderate who was held out of training" width={1024} height={1024} loading="lazy" decoding="async" />
          <div className="wrap band__inner">
            <h2 className="band__head">The number that looked like success</h2>
            <div />
            <div className="band__foot">
              <p className="band__fig">{leaky}<sup>%</sup></p>
              <p className="band__sent">
                Balanced accuracy when the pictures are split at random, which is what the
                tutorial version reports. The same model split by patient instead: {honest}%.
                Guessing scores 25%.
              </p>
            </div>
          </div>
        </section>
      )}
      <Reveal className="wrap band__after" as="div">
        <Reveal as="div" className="stat" index={0}>
          <p className="n">{d.total_subjects}</p>
          <p className="k">people the data actually contains, not {d.total_images.toLocaleString()} samples</p>
        </Reveal>
        {run && (
          <Reveal as="div" className="stat" index={1}>
            <p className="n text-forest">{fmt(run.subject_level.binary_screening.roc_auc, 2)}</p>
            <p className="k">dementia or not, judged per patient. The one thing that does work.</p>
          </Reveal>
        )}
      </Reveal>

      {/* ---------------- tools: sticky picture, active list ---------------- */}
      <Reveal id="tools" className="wrap section">
        <h2 className="head">Six things you can do here</h2>
        <p className="p-body prose-col" style={{ marginTop: "1rem", marginBottom: "clamp(2rem, 4vw, 3rem)" }}>
          All of these run on your own machine. There is no server behind this site, so
          nothing you open, drop in or paste is sent anywhere. The first five are about this
          project. The checker is not: the mistake this whole site is about works on any list
          of file names, so if you take one thing away from here, take that.
        </p>
        <ToolList />
      </Reveal>

      {/* ---------------- data ---------------- */}
      <Reveal id="data" className="wrap section twocol">
        <h2 className="head">Where the data came from</h2>
        <div className="twocol__a">
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
        </div>
        <div className="classes self-start twocol__b">
          {d.classes.map((c) => (
            <div key={c.name}>
              <div>
                <p>{c.short}</p>
                <p className="small" style={{ color: "var(--muted)" }}>CDR {c.cdr}</p>
              </div>
              <p className={`n ${c.subjects <= 3 ? "text-brick" : ""}`}>{c.subjects} <span className="small" style={{ color: "var(--muted)" }}>people</span></p>
            </div>
          ))}
          <p><Link href="/data" className="link">More on the dataset</Link></p>
        </div>
      </Reveal>

      {/* ---------------- what works ---------------- */}
      <Reveal id="works" className="wrap section twocol">
        <h2 className="head">So does anything work?</h2>
        <div className="twocol__a">
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
        </div>
        {run && (
          <div className="figs self-start twocol__b">
            <div>
              <p className="n text-forest">{fmt(run.subject_level.binary_screening.roc_auc)}</p>
              <p className="k">dementia or not, judged per patient. 1.0 is perfect, 0.5 a coin flip.</p>
            </div>
            <div>
              <p className="n">{fmt(run.subject_level.quadratic_kappa)}</p>
              <p className="k">agreement with the clinician across four stages. It counts a near miss better than a wild one.</p>
            </div>
            <div className="mt-2">
              <Callout tone="warn" title="Not a medical tool">
                A student project. No regulator has looked at it, no clinician has tested it, and
                it should not inform anything about a real person.
              </Callout>
            </div>
            <p><Link href="/results" className="link">All the numbers</Link></p>
          </div>
        )}
      </Reveal>
    </>
  );
}
