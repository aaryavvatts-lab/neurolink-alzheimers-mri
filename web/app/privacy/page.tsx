import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, Clause, LegalPage } from "@/components/Legal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this site does and does not collect. Short version: no accounts, no cookies, no tracking, and images you open stay on your own machine.",
};

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      summary="This site has no accounts, no sign-up, no adverts and no tracking. Any scan you open is read by your own browser and is never uploaded. What follows spells that out properly."
    >
      <Clause n={1} title="Who runs this site">
        <p>
          SliceWise is a personal student research project. It is not a company, a clinic or a
          registered organisation, and it is not run on behalf of any university or hospital.
          If you want to reach the person responsible, open an issue on the project&apos;s
          public code repository, which is linked from the{" "}
          <Link href="/references" className="link">references page</Link>.
        </p>
      </Clause>

      <Clause n={2} title="What the site collects directly">
        <p>
          Nothing. There is no sign-up, no login, no contact form, no comment box, no
          newsletter and no payment. The site never asks you for your name, your email
          address or anything else about you, so there is nothing for it to store.
        </p>
      </Clause>

      <Clause n={3} title="What happens to a scan you open">
        <p>
          The demo page lets you drop in an image or pick one of the examples. That image is
          read by your browser, processed by code running on your own computer, and passed to
          a model that has been downloaded to your computer. At no point is the image sent to
          a server, because there is no server that could receive it.
        </p>
        <p>
          You can check this yourself. Open your browser&apos;s network tools, run the demo,
          and you will see the model file being downloaded and nothing being uploaded. You can
          also disconnect from the internet after the page has loaded and the demo will keep
          working.
        </p>
        <p>
          The image is held in your browser&apos;s memory while you are looking at it and is
          gone when you close or reload the tab. It is not written to disk by this site.
        </p>
      </Clause>

      <Clause n={4} title="Cookies and browser storage">
        <p>
          This site sets no cookies. It does not use local storage, session storage or any
          other way of keeping information on your device between visits. There is no consent
          banner because there is nothing to consent to. The{" "}
          <Link href="/cookies" className="link">cookie page</Link> goes into more detail.
        </p>
      </Clause>

      <Clause n={5} title="Analytics and tracking">
        <p>
          There are none. No analytics service, no page-view counter, no heat maps, no session
          recording, no advertising pixels, no social media buttons and no fingerprinting. No
          third-party script runs on this site at all.
        </p>
        <p>
          The fonts are part of the site rather than being fetched from a font service while
          you browse, so loading a page does not tell anyone else that you visited.
        </p>
      </Clause>

      <Clause n={6} title="What the host can see">
        <p>
          The site is published on Vercel. Like any web host, Vercel&apos;s servers handle the
          request your browser makes in order to send the page back, and their systems keep
          normal operational records of that. Those records can include:
        </p>
        <Bullets items={[
          "your IP address",
          "the page or file you asked for",
          "the time of the request",
          "your browser and operating system, as reported by your browser",
          "the site you came from, if you followed a link",
        ]} />
        <p>
          This is standard for every website and is needed to deliver pages and to keep a
          service running. I have not turned on Vercel&apos;s analytics product, so I do not
          receive visitor statistics or a dashboard of who came to the site. Vercel handles
          those operational records under its own privacy policy, which you can read at{" "}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank"
             rel="noopener noreferrer" className="link">vercel.com/legal/privacy-policy</a>.
        </p>
      </Clause>

      <Clause n={7} title="The medical scans used to build the model">
        <p>
          The model was trained on the OASIS collection, which is public research data. Those
          scans were collected with consent for research use and were already stripped of
          identifying details by the people who released them. No scans of anyone else are
          held by this site, and the training data is not published here.
        </p>
        <p>
          The example scans in the demo come from that same public collection. They are
          labelled by an anonymous study code such as OAS1_0007, which does not identify a
          person.
        </p>
      </Clause>

      <Clause n={8} title="Children">
        <p>
          This site is not aimed at children and does not knowingly collect anything from
          anyone, of any age, because it does not collect anything from anyone.
        </p>
      </Clause>

      <Clause n={9} title="Your rights">
        <p>
          Rules such as the UK and EU General Data Protection Regulation give you rights over
          personal data held about you, including the right to see it, correct it or have it
          deleted. Since this site holds no personal data about you, there is nothing for me
          to show you or erase.
        </p>
        <p>
          For the operational records held by the host, contact Vercel using the details in
          their privacy policy, since those records sit with them rather than with me.
        </p>
      </Clause>

      <Clause n={10} title="Changes">
        <p>
          If this ever changes, for example if I add a feature that needs to store something,
          I will update this page and change the date at the top before that feature goes
          live. There is no mailing list to notify, so the date is the way to check.
        </p>
      </Clause>
    </LegalPage>
  );
}
