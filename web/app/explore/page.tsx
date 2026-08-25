"use client";

import VolumeViewer from "@/components/VolumeViewer";
import Link from "next/link";
import { Callout, Page, Prose, Section } from "@/components/ui";

export default function ExplorePage() {
  return (
    <Page
      eyebrow="Tool 02"
      title="Look through a real brain, one cut at a time"
      lede="Each scan in this dataset is 61 slices stacked up through the head. Stack them back together and you can cut through the brain in any direction, which is closer to how these scans are actually read."
    >
      <Section n="1" title="Three planes through one head">
        <div className="mb-8 max-w-prose">
          <Prose>
            <p>
              The dataset ships as separate pictures, so it is easy to forget they were ever
              connected. They were. Put the 61 slices back in order and you have a small block
              of the head, and the other two views can be cut straight out of that block.
            </p>
            <p>
              Pick a patient, drag the box to turn it, and move the sliders. Watch what happens
              to the dark butterfly shape in the middle as you go from a healthy brain to a
              more affected one. Those are the ventricles, the fluid spaces, and they widen as
              tissue around them is lost.
            </p>
          </Prose>
        </div>

        <VolumeViewer />

        <div className="mt-6 max-w-prose">
          <Callout title="One thing to keep in mind">
            The two rebuilt views are stretched vertically. The slices sit further apart than
            the pixels within a slice do, and the exact spacing is not in the files I have, so
            the height of those two pictures is not to scale. The shapes are real, the
            proportions in the up and down direction are not.
          </Callout>
        </div>
      </Section>

      <Section n="2" title="What you are looking for">
        <div className="grid gap-8 md:grid-cols-2">
          <Prose>
            <p>
              The dark butterfly shape near the middle of the brain is the lateral ventricles, a
              pair of fluid-filled chambers. In a healthy brain they are narrow. As tissue is
              lost around them they widen, because the space has to go somewhere.
            </p>
            <p>
              Load a healthy patient, note how thin that shape is, then load the moderate one and
              look again at the same height. That difference is most of what any model working on
              these scans has to go on.
            </p>
          </Prose>
          <Prose>
            <p>
              The line chart underneath shows what the model thinks at every height through the
              head, rather than one answer for the whole scan. Slide the axial control and the
              marker moves with it.
            </p>
            <p>
              Watch how unstable it is near the bottom of the stack, where the slices pass
              through the eyes and the base of the skull and there is barely any brain in frame.
              A single slice is a thin piece of evidence, which is why every number on this site
              averages across a whole scan.
            </p>
          </Prose>
        </div>

        <p className="mt-8 max-w-prose p-body">
          To measure the chambers yourself rather than eyeball them, use the{" "}
          <Link href="/ventricles" className="link">ventricle lab</Link>.
        </p>
      </Section>
    </Page>
  );
}
