import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, Clause, LegalPage } from "@/components/Legal";

export const metadata: Metadata = {
  title: "Cookies",
  description: "This site sets no cookies and uses no browser storage. This page explains what that means and how to check it.",
};

export default function Cookies() {
  return (
    <LegalPage
      title="Cookies"
      summary="This site does not set cookies. It does not use local storage or any other way of keeping data on your device. That is why you were not asked to accept anything."
    >
      <Clause n={1} title="The short answer">
        <p>
          No cookies are set by this site, first party or third party. Nothing is written to
          your device, so nothing is read back on a later visit. Every page load starts from
          scratch and the site cannot tell whether you have been here before.
        </p>
      </Clause>

      <Clause n={2} title="Why there is no consent banner">
        <p>
          Rules such as the EU ePrivacy Directive and the UK Privacy and Electronic
          Communications Regulations require your permission before storing or reading
          information on your device, unless that storage is strictly needed to provide
          something you asked for. Since this site stores nothing at all, there is no
          permission to ask for.
        </p>
        <p>
          Banners that appear on sites with nothing to consent to are noise, so I have not
          added one.
        </p>
      </Clause>

      <Clause n={3} title="What the site does store, briefly, while you use it">
        <p>
          When you run the demo, two things are held in your browser&apos;s memory for as long
          as the tab is open:
        </p>
        <Bullets items={[
          "The model file, roughly 45 MB, which your browser may keep in its normal HTTP cache so that a second visit does not have to download it again. This is the same ordinary caching your browser applies to images and stylesheets, and you can clear it the same way.",
          "The scan you chose or dropped in, held only so it can be drawn on screen and passed to the model. It is discarded when you reload or close the tab.",
        ]} />
        <p>
          Neither of these is a cookie, neither identifies you, and neither is sent anywhere.
        </p>
      </Clause>

      <Clause n={4} title="Third-party cookies">
        <p>
          There are none, because there are no third parties. No analytics service, no
          advertising network, no embedded videos, no social buttons, no comment system, and
          no externally hosted fonts. The only files your browser fetches are from this site&apos;s
          own address.
        </p>
      </Clause>

      <Clause n={5} title="How to check for yourself">
        <p>
          You do not have to take my word for it. In most browsers, press F12 to open the
          developer tools, then:
        </p>
        <Bullets items={[
          "Open the Application or Storage tab and look under Cookies. You should see nothing listed for this site.",
          "Look under Local Storage and Session Storage for the same address. Both should be empty.",
          "Open the Network tab and reload. Every request should point at this site's own domain.",
        ]} />
      </Clause>

      <Clause n={6} title="If this changes">
        <p>
          If I ever add something that needs a cookie, this page will be updated first, a
          proper consent choice will be added, and the date at the top will change. See the{" "}
          <Link href="/privacy" className="link">privacy page</Link> for the wider picture.
        </p>
      </Clause>
    </LegalPage>
  );
}
