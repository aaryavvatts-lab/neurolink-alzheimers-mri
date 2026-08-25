import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, Clause, LegalPage } from "@/components/Legal";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using this site. Short version: it is a student project, it is not medical advice, and it comes with no guarantees.",
};

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      summary="By using this site you accept what follows. The most important part is the first clause, and it is not boilerplate: this is a student project and it must not be used to make any decision about anyone's health."
    >
      <Clause n={1} title="This is not medical advice, and not a medical device">
        <p>
          SliceWise is a research demonstration built by a student. It has not been reviewed
          or approved by any medicines or medical device regulator, including the MHRA in the
          United Kingdom, the FDA in the United States, or any equivalent body elsewhere. It
          has never been tested in a clinic, on a patient, or by a doctor.
        </p>
        <p>
          Nothing on this site is medical advice, a diagnosis, a screening result, or a second
          opinion. Do not use it to decide anything about your health or anyone else&apos;s.
          Do not use it to delay seeing a doctor, to reassure yourself, or to worry yourself.
        </p>
        <p>
          If you are concerned about memory problems, confusion or changes in thinking, please
          speak to a qualified healthcare professional. If someone is in immediate danger,
          contact your local emergency service.
        </p>
      </Clause>

      <Clause n={2} title="What the site is">
        <p>
          A written account of a machine learning experiment, some charts of its results, and
          a demonstration that runs a trained model inside your browser. It is provided free,
          for information and education.
        </p>
      </Clause>

      <Clause n={3} title="What you may do">
        <Bullets items={[
          "Read the site, share links to it, and quote it with attribution.",
          "Run the demonstration on your own images.",
          "Read, copy, change and reuse the source code under the MIT licence, which is included in the code repository.",
          "Cite the project in your own work, though please cite the underlying research papers too, which are listed on the references page.",
        ]} />
      </Clause>

      <Clause n={4} title="What you may not do">
        <Bullets items={[
          "Present output from this model as a medical finding, a diagnosis, or a screening result, to anyone, in any setting.",
          "Use it in a clinical workflow, a triage process, an insurance decision, an employment decision, or anything else that affects a real person.",
          "Upload scans belonging to another person unless you have a legal right to do so. The site cannot see the image, but that does not make it your image to use.",
          "Attempt to disrupt the site, or use automated tools to hammer it in a way that degrades it for others.",
          "Remove or hide the warnings about what this is, if you redistribute the code or the model.",
        ]} />
      </Clause>

      <Clause n={5} title="Accuracy of what is written here">
        <p>
          I have tried to report the results honestly, including the parts that make the
          project look bad. The numbers on this site come from the code in the repository, run
          on the dataset described, and they can be reproduced by anyone who follows the{" "}
          <Link href="/method" className="link">method page</Link>.
        </p>
        <p>
          That said, they come from 347 people from a single collection, and they carry wide
          margins of error. Treat them as one small experiment, not as an established finding.
          Where I make a claim that comes from published research rather than from my own
          work, it is cited.
        </p>
      </Clause>

      <Clause n={6} title="No warranty">
        <p>
          This site and the model are provided as they are, with no promises of any kind. I do
          not promise that the site will be available, that it will work in your browser, that
          it is free of errors, or that any prediction it makes is correct. To the fullest
          extent the law allows, all implied warranties are excluded.
        </p>
      </Clause>

      <Clause n={7} title="Limits on liability">
        <p>
          To the fullest extent the law allows, I am not liable for any loss or harm arising
          from your use of this site or anything you did or did not do because of it. That
          includes health outcomes, financial loss and lost data.
        </p>
        <p>
          Nothing here limits liability where the law does not permit it to be limited, such
          as for death or personal injury caused by negligence, or for fraud.
        </p>
      </Clause>

      <Clause n={8} title="Third-party data and code">
        <p>
          The scans come from the OASIS collection, released by the Knight Alzheimer Disease
          Research Center at Washington University in St. Louis. Their terms govern the data
          itself, and you should read them before using the data in your own work. The MIT
          licence on this project covers the code only, not the scans.
        </p>
        <p>
          The site is built with open source libraries, each under its own licence.
        </p>
      </Clause>

      <Clause n={9} title="Availability and changes">
        <p>
          This is a personal project on free hosting. It may be changed, moved or taken down
          at any time without notice. If these terms change, the date at the top of this page
          changes with them, and continuing to use the site means accepting the new version.
        </p>
      </Clause>

      <Clause n={10} title="Contact">
        <p>
          Questions, corrections and bug reports are welcome through the issue tracker on the
          project&apos;s public code repository. If you think something on this site is wrong,
          please say so, and I would rather fix it than leave it.
        </p>
      </Clause>
    </LegalPage>
  );
}
