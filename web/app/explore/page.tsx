"use client";

import VolumeViewer from "@/components/VolumeViewer";
import VentricleTool from "@/components/VentricleTool";
import { Callout, Page, Prose, Section } from "@/components/ui";

export default function ExplorePage() {
  return (
    <Page
      eyebrow="Explore"
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

      <Section n="2" title="Measure the ventricles yourself">
        <div className="mb-8 max-w-prose">
          <Prose>
            <p>
              Before reaching for a network, it is worth seeing how far a ruler gets you. The
              standard sign of shrinking brain tissue on a scan is that the fluid spaces get
              bigger relative to the brain around them.
            </p>
            <p>
              Move the threshold below and the tool marks every dark pixel inside the brain,
              keeps the parts near the middle, and works out how much of the brain they take
              up. This is roughly the measurement that goes into the simple comparison model on
              the results page.
            </p>
          </Prose>
        </div>

        <VentricleTool />
      </Section>
    </Page>
  );
}
