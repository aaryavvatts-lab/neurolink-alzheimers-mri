"use client";
import Link from "next/link";
import { results as r } from "@/lib/results";
import PatientBrowser from "@/components/PatientBrowser";
import { Callout, Page, Prose, Section } from "@/components/ui";

export default function PatientsPage() {
  return (
    <Page
      eyebrow="Tool 04"
      title="Every held-out patient, and what the model said about them"
      lede="Aggregate numbers hide the shape of a model's mistakes. This is the whole test set, one row per person, so you can see exactly who it got right and how badly it missed the rest."
    >
      <Section n="1" title="The test set">
        <PatientBrowser r={r} />
      </Section>

      <Section n="2" title="What to look for">
        <div className="grid gap-8 md:grid-cols-2">
          <Prose>
            <p>
              Sort by stage and the pattern is hard to miss. The healthy patients are handled
              well. The very mild group gets split roughly down the middle. Below that the model
              mostly stops working.
            </p>
            <p>
              Now sort by confidence and look at the mistakes near the top. Those are cases where
              the model was sure and wrong, which is the worst kind of error a screening tool can
              make, and the reason the results page spends time on whether its confidence can be
              trusted at all.
            </p>
          </Prose>
          <Prose>
            <p>
              The coloured bar in each row is the full answer rather than just the winner. A row
              where the bar is split evenly between two stages is a model saying it cannot tell,
              even though a single label has to be picked from it.
            </p>
            <p>
              There is one moderate patient in this table. Not a small group, one person. Any
              statement about how the model handles moderate dementia is a statement about them.
            </p>
          </Prose>
        </div>

        <div className="mt-8 max-w-prose">
          <Callout title="These are people, not rows">
            Each line is a real person who agreed to have their brain scanned for research, whose
            data was anonymised and released so that work like this is possible. The codes are
            study identifiers and carry no personal detail. It still seems worth remembering that
            a wrong prediction here is a wrong prediction about someone.
          </Callout>
        </div>

        <p className="mt-6 max-w-prose p-body">
          The <Link href="/results" className="link">results page</Link> turns this table into the
          usual summary numbers, and explains which of them are worth quoting.
        </p>
      </Section>
    </Page>
  );
}
