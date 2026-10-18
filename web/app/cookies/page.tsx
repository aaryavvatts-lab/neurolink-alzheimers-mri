import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, Clause, LegalPage } from "@/components/Legal";

export const metadata: Metadata = {
  title: "Cookies",
  description: "This site sets no cookies. The only thing it stores is the theme you pick. This page explains what that means and how to check it.",
};

export default function Cookies() {
  return (
    <LegalPage
      title="Cookies"
      summary="This site does not set cookies. The only thing it keeps on your device is the theme you pick, and only when you pick one. That is why you were not asked to accept anything."
    >
      <Clause title="The short answer">
        <p>
          No cookies are set by this site, first party or third party. The only thing written
          to your device is one word, light or dark, if you press the theme control in the
          header, so the next page keeps the theme you chose. It carries no identifier and the
          site cannot tell whether you have been here before.
        </p>
      </Clause>

      <Clause title="Why there is no consent banner">
        <p>
          Rules such as the EU ePrivacy Directive and the UK Privacy and Electronic
          Communications Regulations require your permission before storing or reading
          information on your device, unless that storage is strictly needed to provide
          something you asked for. The theme preference is exactly that, a setting you asked
          for, and nothing else is stored, so there is no permission to ask for.
        </p>
        <p>
          Banners that appear on sites with nothing to consent to are noise, so I have not
          added one.
        </p>
      </Clause>

      <Clause title="What the site does store, briefly, while you use it">
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

      <Clause title="Third-party cookies">
        <p>
          There are none, because there are no third parties. No analytics service, no
          advertising network, no embedded videos, no social buttons, no comment system, and
          no externally hosted fonts. The only files your browser fetches are from this site&apos;s
          own address.
        </p>
      </Clause>

      <Clause title="How to check for yourself">
        <p>
          You do not have to take my word for it. In most browsers, press F12 to open the
          developer tools, then:
        </p>
        <Bullets items={[
          "Open the Application or Storage tab and look under Cookies. You should see nothing listed for this site.",
          "Look under Local Storage for the same address. It holds a single entry named theme if you have pressed the theme control, and nothing otherwise. Session Storage is empty.",
          "Open the Network tab and reload. Every request should point at this site's own domain.",
        ]} />
      </Clause>

      <Clause title="If this changes">
        <p>
          If I ever add something that needs a cookie, this page will be updated first, a
          proper consent choice will be added, and the date at the top will change. See the{" "}
          <Link href="/privacy" className="link">privacy page</Link> for the wider picture.
        </p>
      </Clause>
    </LegalPage>
  );
}
