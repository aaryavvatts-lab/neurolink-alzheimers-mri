"use client";
import Link from "next/link";
import { results as r } from "@/lib/results";
import SplitSimulator from "@/components/SplitSimulator";
import { Page, Prose, Ref, Section } from "@/components/ui";

export default function SplitPage() {
  return (
    <Page
      eyebrow="Tool 05"
      title="Watch a bad split invent accuracy"
      lede="This is the mistake at the centre of the project, drawn out square by square. Move the sliders and you can see exactly how a patient ends up on both sides of a train and test boundary."
    >
      <Section n="1" title="The simulator">
        <SplitSimulator r={r} />
      </Section>

      <Section n="2" title="Why this matters more than it sounds">
        <div className="grid gap-8 md:grid-cols-2">
          <Prose>
            <p>
              Splitting data into a training pile and a testing pile is the most basic step in
              machine learning, and it is usually one line of code. That line quietly assumes
              your rows are independent of each other.
            </p>
            <p>
              In this dataset they are not. One person was scanned four times, and each scan was
              cut into 61 thin slices. Slice 119 and slice 120 of the same head are close to the
              same photograph. Shuffling those rows at random spreads every patient across both
              piles.
            </p>
          </Prose>
          <Prose>
            <p>
              The model can then take a shortcut. Instead of learning what a shrinking brain
              looks like, it can learn what this particular skull looks like, and recall the
              answer when it meets that skull again in testing.
            </p>
            <p>
              Nothing about this produces an error. The code runs, the loss falls, the accuracy
              climbs. Yagis and colleagues measured about 30 points of inflation from exactly
              this on the same collection<Ref n={2} />, and found the same effect with the labels
              shuffled at random, which is the cleanest possible proof that the score was
              measuring memory.
            </p>
          </Prose>
        </div>

        <p className="mt-8 max-w-prose p-body">
          If you want to check your own data for this, the{" "}
          <Link href="/check" className="link">checker</Link> reads a list of file names and
          tells you whether it would happen to you.
        </p>
      </Section>
    </Page>
  );
}
