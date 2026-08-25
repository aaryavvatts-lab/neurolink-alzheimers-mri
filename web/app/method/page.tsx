"use client";

import { useResults } from "@/lib/useResults";
import { Callout, Figure, Page, Prose, Ref, Section } from "@/components/ui";
import { Loading } from "@/components/Loading";

const STEPS: [string, string][] = [
  ["Turn it grey",
   "The files are stored with three colour channels, but I checked 200 of them at random and all three channels hold identical numbers. MRI is a single brightness value per point, so two of the three channels are wasted space."],
  ["Undo the stretch",
   "Every file is 496 by 248. That is a square slice pulled to twice its width. Resizing it back to square puts the head back in proportion. Skip this and you train on squashed brains."],
  ["Find the head and crop to it",
   "I take a square box around the head with a small margin. This is what centring the picture actually means here. It removes differences in where the head sat in the frame, so the network sees anatomy rather than framing."],
  ["Even out the brightness",
   "I clip the darkest and brightest one percent of the pixels inside the head and stretch what is left across the full range. Doing this inside the head matters. Measured across the whole frame you mostly measure how much black background there is."],
  ["Shrink and store",
   "Everything gets saved once at 224 by 224 as plain bytes in one long file. After that, a training pass reads raw numbers instead of unpacking 86,437 JPGs, which is the difference between this being possible on a laptop and not."],
];

export default function MethodPage() {
  const { data: r } = useResults();

  return (
    <Page
      eyebrow="Method"
      title="How it was built, and what went wrong along the way"
      lede="The interesting parts of this project were all mistakes I nearly shipped. Three of them would never have thrown an error."
    >
      <Section n="1" title="Getting the pictures ready">
        <div className="max-w-prose">
          <Prose>
            <p>
              The video that started this said to regularise the images and centre the pixels.
              That is vague, so here is what it actually means for this particular dataset.
            </p>
          </Prose>
        </div>

        <ol className="mt-8 max-w-prose space-y-6">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rule font-mono text-[0.75rem] text-muted">
                {i + 1}
              </span>
              <div>
                <p className="font-serif text-[1.0625rem] text-ink">{t}</p>
                <p className="mt-1 p-body">{d}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          <Figure
            src="/figures/preprocessing_probe.png"
            alt="Eight brain scans shown at four stages of processing."
            caption="Two scans from each stage of dementia, going through the steps above."
          />
        </div>

        <div className="mt-8 max-w-prose">
          <Callout tone="warn" title="The mistake I caught by looking">
            My first version found the head using Otsu's method, which is the standard way to
            pick a threshold. It picks the value that best separates an image into two groups.
            The trouble is the background in these scans is already pure black, so the
            interesting split is trivial, and Otsu instead lands on a value that cuts through
            brain tissue. On a dim scan it broke the head into pieces, the crop landed
            halfway across the skull, and the brightness step then blew the picture out to
            white. I only noticed because I drew the steps out and looked at them. A low fixed
            cut-off against a black background fixed it.
          </Callout>
        </div>
      </Section>

      <Section n="2" title="Splitting the data, and a guard that shouts">
        <div className="max-w-prose">
          <Prose>
            <p>
              Splits are made on the person, never on the picture. A patient is either
              entirely in the training pile or entirely in the testing pile.
            </p>
            <p>
              Because this is the one thing that decides whether any of the numbers mean
              anything, every training run checks it before it starts, and stops outright
              rather than printing a warning nobody reads.
            </p>
          </Prose>
        </div>

        <pre className="scroll-x mt-6 max-w-prose border border-rule bg-white p-4 font-mono text-[0.8125rem] leading-relaxed text-body">
{`overlap = set(train_subjects) & set(test_subjects)
if overlap:
    raise ValueError(
        f"SUBJECT LEAKAGE: {len(overlap)} subject(s) appear in "
        "both train and test. Any metric from this split is "
        "meaningless."
    )`}
        </pre>

        <div className="mt-6 max-w-prose">
          <Prose>
            <p>
              The guard has a test that hands it a random picture-level split on purpose, to
              prove it fires. A check nobody has ever watched fail is a guess. When you run
              that test on this dataset it reports all {r?.dataset.total_subjects ?? 347}{" "}
              patients on both sides at once, which is a blunt way of seeing the problem.
            </p>
          </Prose>
        </div>
      </Section>

      <Section n="3" title="The model">
        <div className="max-w-prose">
          <Prose>
            <p>
              A ResNet-18 that already knows about everyday photographs, retrained on these
              scans. I also trained a small network from scratch to see whether starting from
              photographs helps at all on grey medical images, since that is often assumed
              rather than checked.
            </p>
            <p>
              Both end the same way: average everything down to one number per feature, then
              a single layer that turns those into four scores. That choice is not cosmetic.
              It means the attention picture on the demo page is just the final feature maps
              added up using the weights of that last layer. No gradients are needed, which
              is what lets the same calculation run in a browser.
            </p>
            <p>
              About 78 percent of the pictures come from people with no dementia, so I draw
              training batches in a way that shows each stage roughly equally often.
            </p>
          </Prose>
        </div>

        <div className="mt-6 max-w-prose">
          <Callout title="A correction I made partway through">
            I was doing two things to fix the imbalance at once: sampling the rare stages more
            often, and separately telling the loss to care about them more. Together that gave
            the moderate group six times the pull of any other group, and the moderate group
            has one person in the training set. I left the two comparison runs alone, because
            changing them would have broken the comparison, and instead added a switch and a
            second run so the choice could be made on measurements rather than on my guess.
          </Callout>
        </div>
      </Section>

      <Section n="4" title="Running the model in a browser">
        <div className="max-w-prose">
          <Prose>
            <p>
              The site has no server. A static host cannot run PyTorch, so the trained model
              is converted to ONNX and executed on your machine using WebAssembly. That also
              means no scan you open ever leaves your computer.
            </p>
            <p>
              Getting this right took two fixes worth writing down.
            </p>
            <p>
              The first was file size. The default converter writes the pooling step in a way
              the compression tool cannot read, which forced a 45 MB download. Switching to
              the older converter produced a simpler graph that compresses to 11 MB. Before
              anything ships, the converted model is compared against PyTorch on 200 real
              scans, and if the compressed version disagrees on more than one in a hundred it
              is thrown away and the large one is used instead.
            </p>
            <p>
              The second was subtler. The browser has its own copy of the image handling
              written in TypeScript. Mine used simple interpolation where the Python used two
              different and more careful methods. Nothing failed. The pictures still looked
              like brains. But the numbers going into the model were slightly wrong, which
              means every prediction would have been slightly wrong with nothing to show for
              it. There is now a test that compares the two versions on real files and refuses
              to pass unless they agree to four decimal places.
            </p>
          </Prose>
        </div>
      </Section>

      <Section n="5" title="How the scoring works">
        <div className="max-w-prose">
          <Prose>
            <p>
              A model gives an answer per slice, but a patient is one person. So I average the
              model&apos;s four scores across every slice belonging to that patient and take
              the answer once. That is the number worth quoting, and it is the one used
              throughout the results.
            </p>
            <p>
              The four stages are ordered, not just different. Mistaking no dementia for
              moderate dementia is worse than mistaking it for very mild. Plain accuracy
              cannot see that difference, so I also report a weighted agreement score that
              can<Ref n={10} />.
            </p>
            <p>
              Confidences are corrected on a held-out group of patients before any of the
              confidence-based charts are drawn, because a model trained with rebalanced
              batches comes out overconfident and would otherwise make the abstention chart
              look better than it is.
            </p>
          </Prose>
        </div>
      </Section>

      <Section n="6" title="Running it yourself">
        <div className="max-w-prose">
          <Prose>
            <p>
              Everything is in one repository. The dataset is not included because it is 1.4
              GB, but the readme says where to get it and the code expects the four folders
              exactly as they are downloaded.
            </p>
          </Prose>
        </div>
        <pre className="scroll-x mt-6 max-w-prose border border-rule bg-white p-4 font-mono text-[0.8125rem] leading-relaxed text-body">
{`uv venv --python 3.12 && uv sync
ln -s /path/to/Data data

# look at the processing before trusting it
python -m src.neurolink.data.preprocess --probe 2

# build the cache, the splits, and check the guard fires
python -m src.neurolink.data.preprocess
python -m src.neurolink.data.splits

# the whole thing, about two hours on a laptop
./scripts/run_stage_a.sh`}
        </pre>
      </Section>
    </Page>
  );
}
