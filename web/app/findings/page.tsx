"use client";

import Link from "next/link";
import { results as r } from "@/lib/results";
import { fmt } from "@/lib/types";
import { Callout, Page, Prose, Ref, Section, Stat } from "@/components/ui";
import LeakageBars from "@/components/charts/LeakageBars";
import ModelCompare from "@/components/charts/ModelCompare";

export default function FindingsPage() {
  const lk = r.leakage_experiment;
  const probe = r.shortcut_probe;
  const scratch = r.runs["scratch_cnn_holdout"];
  const resnet = r.runs["leakage_honest_subject_split"];
  const cam = r.cam_ventricle_overlap;

  return (
    <Page
      eyebrow="Findings"
      title="Three things this project showed, two of which I did not want"
      lede="I set out to build an Alzheimer's classifier. What I ended up with is a set of measurements about how easy it is to fool yourself, which turned out to be the more useful result."
    >
      {/* ---------------- 1 ---------------- */}
      <Section n="01" id="leakage" title="Almost all of the accuracy came from how the data was split">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Prose>
            <p>
              The dataset holds 86,437 pictures from 347 people. Each person was scanned four
              times and each scan was cut into 61 slices, so one person becomes roughly 244
              pictures that all look nearly the same.
            </p>
            <p>
              I trained the same network twice. Same shape, same settings, same number of passes,
              same random seed. The only difference was whether the split was made on pictures or
              on people.
            </p>
            <p>
              Splitting on pictures put every single one of the 347 patients into both the
              training and the test set. Not most of them. All of them.
            </p>
          </Prose>
          {lk && (
            <aside className="grid gap-5 self-start sm:grid-cols-2 lg:grid-cols-1">
              <Stat tone="brick"
                    value={`${(lk.leaky_random_split.balanced_accuracy * 100).toFixed(1)}%`}
                    label="Split on pictures" note="the number that looks like success" />
              <Stat tone="steel"
                    value={`${(lk.honest_subject_split_slice_level.balanced_accuracy * 100).toFixed(1)}%`}
                    label="Split on people" note="guessing scores 25%" />
            </aside>
          )}
        </div>

        <div className="mt-8"><LeakageBars r={r} /></div>

        <div className="mt-6 max-w-prose space-y-4">
          <Prose>
            <p>
              Plain accuracy only fell about 21 points, because most patients here are healthy
              and answering healthy is often right. Balanced accuracy, which treats all four
              stages as equally important, fell by roughly 65 points and landed just above
              guessing.
            </p>
            <p>
              None of this is new. Yagis and colleagues ran the same comparison on this collection
              in 2021 and reported about 30 points of inflation<Ref n={2} />. They also did
              something sharper: they shuffled the labels so the pictures meant nothing at all,
              and a picture-level split still reported about 96 percent. A patient-level split
              gave 50 percent, which is what noise should give. The same problem has been
              documented in brain wave recordings<Ref n={3} /> and eye scans<Ref n={4} />.
            </p>
          </Prose>
          <Callout title="You can try this one yourself">
            The <Link href="/split" className="link">split simulator</Link> draws it square by
            square, and the <Link href="/check" className="link">checker</Link> will tell you
            whether your own dataset has the same problem.
          </Callout>
        </div>
      </Section>

      {/* ---------------- 2 ---------------- */}
      <Section n="02" id="probe" title="Erasing the brain barely hurt the model">
        <div className="max-w-prose">
          <Prose>
            <p>
              A model can score well for reasons that have nothing to do with the thing you care
              about. To check for that I rubbed the brain out of every picture, leaving only the
              skull rim and the black background, and trained the whole thing again from scratch.
            </p>
            <p>
              There is no information about dementia in those images. A human radiologist could
              not do better than guess. The score should have collapsed.
            </p>
          </Prose>
        </div>

        {probe && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat tone="brick" value={fmt(probe.subject_level_balanced_accuracy)}
                  label="Score with the brain erased" />
            <Stat value={probe.chance_level.toFixed(2)} label="Score from guessing" />
            <Stat value={fmt(probe.best_real_model_balanced_accuracy)}
                  label="Best model that can see the brain" />
            <Stat tone="brick"
                  value={probe.margin_over_probe != null
                    ? `+${(probe.margin_over_probe * 100).toFixed(1)} pts`
                    : "n/a"}
                  label="What the entire brain was worth" />
          </div>
        )}

        <div className="mt-6 max-w-prose space-y-4">
          <Prose>
            <p>
              Head size, skull thickness and scalp shape all change with age. Age is the single
              strongest risk factor for dementia there is. So a model can pick up a genuine
              statistical relationship without ever looking at brain tissue, and it will look
              like it is diagnosing.
            </p>
            <p>
              This is not the model cheating. It is a gap in what the labels can distinguish, and
              it is the kind of thing that only shows up if you build the control on purpose.
            </p>
          </Prose>
          <Callout tone="warn" title="I got the pass mark wrong the first time">
            I had originally written this check to pass if the brain-removed score stayed below
            guessing plus fifteen points. By that rule it passed, and I nearly wrote it up as a
            clean result. The rule was wrong. The distance that matters is not the distance from
            guessing, it is the distance from the real model, and that turned out to be about
            three points. Comparing against a round number I picked myself would have let me
            report a pass for something that is not passing.
          </Callout>
        </div>
      </Section>

      {/* ---------------- 3 ---------------- */}
      <Section n="03" id="pretraining" title="The small network beat the big pretrained one">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Prose>
            <p>
              Starting from a network that already knows about everyday photographs is standard
              practice, and it is usually treated as free improvement. I used ResNet-18, trained
              on ImageNet, which is about as standard as it gets.
            </p>
            <p>
              A plain convolutional network with a fifth of the parameters, starting from nothing,
              beat it on every measure I looked at.
            </p>
            <p>
              I would not turn this into a rule about pretraining. With 242 people to learn from,
              the bigger model had far more capacity than the data could fill, and more room to
              memorise. The point is narrower and more useful: this is checkable in an afternoon,
              and worth checking rather than assuming.
            </p>
          </Prose>
          {scratch && resnet && (
            <aside className="grid gap-5 self-start sm:grid-cols-2 lg:grid-cols-1">
              <Stat tone="forest" value={fmt(scratch.subject_level.balanced_accuracy)}
                    label="Small network, from scratch" note="2.4 million parameters" />
              <Stat value={fmt(resnet.subject_level.balanced_accuracy)}
                    label="ResNet-18, pretrained" note="11.2 million parameters" />
            </aside>
          )}
        </div>

        <div className="mt-8"><ModelCompare r={r} /></div>

        <p className="mt-6 max-w-prose p-body">
          It had a practical benefit too. The smaller model exports to 9.4 MB instead of 44.7 MB,
          which is what the <Link href="/try" className="link">demo</Link> downloads to your
          browser.
        </p>
      </Section>

      {/* ---------------- 4 ---------------- */}
      <Section n="04" id="attention" title="And the attention maps do not survive a control either">
        <div className="max-w-prose">
          <Prose>
            <p>
              Heatmaps showing where a model looked are convincing and easy to over-read. A warm
              blob near the ventricles looks like anatomical understanding.
            </p>
            <p>
              So I measured it. I marked the fluid chambers on each slice, took the region the
              model weighted most heavily, made the two regions the same size, and computed the
              overlap properly. Then I did the same for two things that understand nothing: an
              untrained network, and a plain circle in the middle of the frame.
            </p>
          </Prose>
        </div>

        {cam && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat tone="steel" value={fmt(cam.trained_model.dice, 3)}
                  label="Trained model" note="overlap with the fluid chambers" />
            <Stat value={fmt(cam.control_centred_blob.dice, 3)}
                  label="A plain centred circle" note="no thought involved" />
            <Stat value={fmt(cam.control_untrained_cnn.dice, 3)}
                  label="An untrained network" note="random weights" />
          </div>
        )}

        <div className="mt-6 max-w-prose">
          <Callout tone="warn">
            The circle wins. Whatever the model is attending to, its overlap with the ventricles
            is explained by the fact that brains are centred in these images, not by anatomy. If
            I had shown the heatmaps without the controls, they would have looked like evidence.
          </Callout>
        </div>
      </Section>

      <Section n="05" title="What I would tell someone starting this project">
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {[
            ["Count your people, not your files.",
             "The first number to work out is how many independent things the data actually came from. Here it was 347, not 86,437, and everything else follows from that."],
            ["Build the control before the model.",
             "The brain-removed run took an hour and changed how I read every other number. It would have been worth doing first."],
            ["Do not pick your own pass mark.",
             "A threshold you chose yourself is not a test, it is a wish. Compare against something measured on the same data."],
            ["Check the simple thing first.",
             "Eight measurements and a plain fit got close to the network. If I had run that at the start I would have known what beating it required."],
            ["Look at your images.",
             "Two real bugs here were only visible because I drew the preprocessing steps out and looked. Neither produced an error message."],
            ["Report the number that fell.",
             "The interesting result was the one that made the project look worse. That is usually where the actual finding is."],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="font-serif text-[1.0625rem] text-ink">{t}</p>
              <p className="mt-1.5 p-body">{d}</p>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  );
}
