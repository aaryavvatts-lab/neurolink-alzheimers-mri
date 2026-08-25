"use client";

import Link from "next/link";
import { results as r } from "@/lib/results";
import { Callout, Figure, Page, Prose, Ref, Section, Stat } from "@/components/ui";
import DatasetBars from "@/components/charts/DatasetBars";

export default function DataPage() {
  const d = r.dataset;
  return (
    <Page
      eyebrow="The data"
      title="347 people, and why that is the whole story"
      lede="Everything this project found comes back to one thing: the folder looks like a large dataset and is not one. It is worth being precise about what is actually in it."
    >
      <Section n="1" title="Where these scans came from">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Prose>
            <p>
              The pictures come from OASIS, the Open Access Series of Imaging Studies, released
              by the Knight Alzheimer Disease Research Center at Washington University in St.
              Louis<Ref n={1} />. It was one of the first large brain imaging collections put
              out for anyone to use, and it has been cited a couple of thousand times since.
            </p>
            <p>
              The original release holds 416 people aged 18 to 96. The version that circulates
              for machine learning is a subset: the older participants, sliced up and sorted into
              four folders by dementia rating. That is what I worked from.
            </p>
            <p>
              Everyone in it consented to research use and the scans were stripped of identifying
              detail before release. Patients appear only as codes like OAS1_0028.
            </p>
          </Prose>
          <aside className="grid gap-5 self-start sm:grid-cols-2 lg:grid-cols-1">
            <Stat value={d.total_images.toLocaleString()} label="Picture files in the folder" />
            <Stat tone="brick" value={`${d.total_subjects}`} label="People those files came from" />
            <Stat value={`${d.slices_per_subject_median}`}
                  label="Pictures per person, typically"
                  note={`slices ${d.slice_index_range[0]} to ${d.slice_index_range[1]}, four scans each`} />
          </aside>
        </div>
      </Section>

      <Section n="2" title="Counted two ways">
        <DatasetBars r={r} />

        <div className="mt-6 max-w-prose">
          <Prose>
            <p>
              Switch that chart between files and people. Counted as files it looks like a
              reasonable dataset with an imbalance problem. Counted as people it looks like a
              small study where one group has two members.
            </p>
          </Prose>
        </div>

        <div className="mt-6 scroll-x">
          <table className="data min-w-[560px]">
            <thead>
              <tr>
                <th>Stage</th><th>Rating</th><th>What it means</th>
                <th className="text-right">Files</th><th className="text-right">People</th>
              </tr>
            </thead>
            <tbody>
              {d.classes.map((c, i) => (
                <tr key={c.name}>
                  <td className="pr-4">{c.name}</td>
                  <td>CDR {c.cdr}</td>
                  <td className="pr-4 text-muted">
                    {["No dementia",
                      "Very mild, roughly what others call mild cognitive impairment",
                      "Mild dementia",
                      "Moderate dementia"][i]}
                  </td>
                  <td className="text-right">{c.images.toLocaleString()}</td>
                  <td className={`text-right ${c.subjects <= 3 ? "text-brick" : ""}`}>
                    {c.subjects}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 max-w-prose">
          <Callout tone="warn" title="Two people is not a category">
            No split, no amount of flipping and rotating images, and no cross-validation scheme
            turns two people into a group you can learn from or test on. With a patient-level
            split, one goes in training and one goes in testing. Every moderate dementia number
            on this site describes one individual, and it is flagged wherever it appears rather
            than quietly averaged in.
          </Callout>
        </div>
      </Section>

      <Section n="3" title="What the labels actually are">
        <div className="grid gap-8 md:grid-cols-2">
          <Prose>
            <p>
              The four folders correspond to the Clinical Dementia Rating, a score a clinician
              assigns after interviewing the patient and someone who knows them well. It covers
              memory, orientation, judgement, community affairs, home life and personal care.
            </p>
            <p>
              Zero means no dementia. Half means very mild, which overlaps with what other
              studies call mild cognitive impairment. One is mild and two is moderate<Ref n={10} />.
            </p>
          </Prose>
          <Prose>
            <p>
              This matters for what the model can possibly learn. The label is a human judgement
              about a person, not a measurement of their brain. It was not confirmed by looking
              at tissue after death, which is the only way to be certain about Alzheimer&apos;s.
            </p>
            <p>
              So the best a model can do is imitate that judgement, including the places where
              the judgement itself is uncertain. The boundary between no dementia and very mild
              is exactly where clinicians disagree most, and it is exactly where the model does
              worst.
            </p>
          </Prose>
        </div>
      </Section>

      <Section n="4" title="Two things the files hide">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-serif text-[1.125rem] text-ink">
              They are stretched.
            </p>
            <div className="mt-2">
              <Prose>
                <p>
                  Every file is 496 pixels wide and 248 tall. That is a square slice pulled to
                  twice its width somewhere in the export. Feed it straight to a network and you
                  are training on squashed heads.
                </p>
                <p>
                  Nothing in the folder tells you this. You find it by opening a file and
                  noticing the brain looks wrong.
                </p>
              </Prose>
            </div>
          </div>
          <div>
            <p className="font-serif text-[1.125rem] text-ink">
              They are a volume pretending to be pictures.
            </p>
            <div className="mt-2">
              <Prose>
                <p>
                  The 61 slices for a scan are consecutive cuts up through one head. Stacked back
                  in order they are a small three-dimensional block, which is how these scans are
                  actually read.
                </p>
                <p>
                  Stored as separate JPGs, that structure is invisible, and it is exactly the
                  structure that makes a random split so damaging. You can put the stack back
                  together on the{" "}
                  <Link href="/explore" className="link">explorer</Link>.
                </p>
              </Prose>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Figure
            src="/figures/preprocessing_probe.png"
            alt="Eight brain scans shown at four stages: the raw wide file, the slice with its shape restored, the detected head box, and the final square image."
            caption="Two scans from each stage going through the fix. The brains get noticeably rounder once the stretch is undone, which is the first thing that has to happen before any of this is worth doing."
          />
        </div>
      </Section>

      <Section n="5" title="Getting it yourself">
        <div className="max-w-prose">
          <Prose>
            <p>
              The dataset is not in the code repository because it is 1.4 GB. The slice-by-slice
              version used here circulates on Kaggle, sorted into the four folders by rating. The
              original scans and the full clinical data come from the OASIS project directly.
            </p>
            <p>
              If you use it, please follow the OASIS terms and cite Marcus and colleagues<Ref n={1} />.
              If you want a bigger and more recent version, OASIS-3 has 1,098 participants with
              longitudinal imaging<Ref n={11} />, which would fix most of what limits this project.
            </p>
          </Prose>
        </div>
      </Section>
    </Page>
  );
}
