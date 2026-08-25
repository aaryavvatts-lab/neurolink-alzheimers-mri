"use client";

import LeakChecker from "@/components/LeakChecker";
import { Callout, Page, Prose, Ref, Section } from "@/components/ui";

export default function CheckPage() {
  return (
    <Page
      eyebrow="Tool"
      title="Check your own dataset for the same mistake"
      lede="Paste your file names. This works out what several of your files have in common, then tells you whether a plain random split would put the same patient, speaker or video on both sides of your train and test line."
    >
      <Section n="1" title="Why this tool exists">
        <div className="max-w-prose">
          <Prose>
            <p>
              I lost a day to this. The code ran, the loss went down, the score was 99 percent,
              and none of it meant anything. There was no error message because nothing had
              gone wrong in the code. The mistake was in how I counted my data.
            </p>
            <p>
              It is not a brain scan problem. It happens any time many files come from one
              source: slices from a patient, frames from a video, clips from a speaker, photos
              of a single object, repeated measurements from one sensor. Published surveys have
              found the same thing in brain wave studies<Ref n={3} /> and eye scans
              <Ref n={4} />, and one review found most translational studies in its field did
              it<Ref n={7} />.
            </p>
            <p>
              So this is the check I wish I had run first. Everything happens in your browser.
              Only the names are looked at, never the contents, and nothing is uploaded.
            </p>
          </Prose>
        </div>
      </Section>

      <Section n="2" title="The checker">
        <LeakChecker />
      </Section>

      <Section n="3" title="What it can and cannot tell you">
        <div className="grid gap-8 md:grid-cols-2">
          <Prose>
            <p>
              It can only see what is in the names. If your patient identifier lives in a
              database column and your files are called 00001.png through 40000.png, no tool
              reading filenames will help you. In that case, group on the column.
            </p>
            <p>
              It also cannot tell you whether your grouping is the right one. If you have
              several scans of the same person taken years apart, the person is the group, not
              the visit. Only you know that.
            </p>
          </Prose>
          <Prose>
            <p>
              What it does do is catch the common case quickly: a folder full of files whose
              names clearly repeat an identifier, about to be shuffled at random.
            </p>
            <p>
              If it says your split is clean, that is worth something but it is not a
              guarantee. There are other ways to leak, such as fitting a scaler on all your
              data before splitting, or picking features using the test set. A recent overview
              catalogues a good number of them<Ref n={7} />.
            </p>
          </Prose>
        </div>

        <div className="mt-8 max-w-prose">
          <Callout title="If you find something">
            Finding leakage in your own work is not a disaster, it is a saved paper. Regroup
            the split, rerun, and report the new number. It will be lower. It will also be
            real, and the difference between those two things is the whole job.
          </Callout>
        </div>
      </Section>
    </Page>
  );
}
