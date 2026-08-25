"use client";

import Demo from "@/components/Demo";
import { Callout, Page, Prose, Section } from "@/components/ui";

export default function TryPage() {
  return (
    <Page
      eyebrow="Tool 01"
      title="Run the model on a brain scan"
      lede="Drop in one scan or a whole folder of slices. Several images from the same scan are averaged into a single answer, which is how every number on this site is measured. You get the full breakdown, an honest read on how much to trust it, and a report you can keep. All of it runs on your own machine."
    >
      <Section n="1" title="The demo">
        <Demo />
      </Section>

      <Section n="2" title="What you are looking at">
        <div className="grid gap-8 md:grid-cols-2">
          <Prose>
            <p>
              The bars show how much weight the model puts behind each of the four stages.
              They always add up to 100 percent, so a tall bar does not mean the model is
              right. It means it is confident, and confidence and correctness are not the
              same thing.
            </p>
            <p>
              The warm colours drawn over the scan mark the parts of the slice that pushed
              the answer hardest. This comes straight from the last layer of the network and
              the weights of its final classifier, so it is not a guess about what the model
              did. It is what the model did. The map is coarse though, only five by five
              boxes stretched over the whole slice, so read it as a rough region and not a
              precise outline.
            </p>
          </Prose>
          <Prose>
            <p>
              Every example in the gallery belongs to a patient who was kept out of training
              completely. For each one I also worked out the answer in Python ahead of time.
              When you click a scan, the page compares the two. If they ever stop matching,
              it says so on screen instead of quietly showing you a wrong answer.
            </p>
            <p>
              You can drop in your own images, and dropping in several from the same scan is
              worth doing. One slice is thin evidence and the answer moves depending on where
              the cut was taken. Averaging a whole scan is the unit every number on this site
              is measured in, and the page will tell you how many of the individual slices
              actually agreed with the overall answer.
            </p>
            <p>
              It will only make sense for scans that look like the ones here: a flat slice
              through the head, roughly at eye level or above, on a black background. Drop in a
              photograph and you will get four confident numbers about nothing, which is worth
              seeing once.
            </p>
          </Prose>
        </div>

        <div className="mt-8 max-w-prose">
          <Callout tone="warn" title="Please do not read anything into this about a real person">
            This model was trained on 242 people from a single research collection, on one
            scanner, at one point in time. It has never been tested in a clinic. It has no
            approval from anyone. Whatever it says about a scan, including a scan of someone
            you know, means nothing about their health.
          </Callout>
        </div>
      </Section>
    </Page>
  );
}
