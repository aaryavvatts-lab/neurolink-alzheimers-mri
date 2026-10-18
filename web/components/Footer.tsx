import Link from "next/link";
import { TOOLS, READ, LEGAL } from "@/lib/nav";

export default function Footer() {
  return (
    <footer className="wrap close">
      <p className="close__mark">SliceWise</p>
      <p>
        <strong>This is a student project, not a medical tool.</strong>{" "}
        Nothing here is approved by any regulator, and nothing here should be used to decide
        anything about a real person. If you are worried about memory problems, please speak
        to a doctor.
      </p>
      <p>
        Built on the OASIS brain MRI collection. The model runs in your browser, so no scan
        you open here is sent anywhere. The pictures on this site are slices from that same
        public collection, labelled only by study code.
      </p>
      <nav className="close__meta" aria-label="Tools">
        {TOOLS.map(([href, name]) => <Link key={href} href={href}>{name}</Link>)}
      </nav>
      <nav className="close__meta" aria-label="Read and policies">
        {READ.map(([href, name]) => <Link key={href} href={href}>{name}</Link>)}
        {LEGAL.map(([href, name]) => <Link key={href} href={href}>{name}</Link>)}
        <a href="https://github.com/aaryavvatts-lab/neurolink-alzheimers-mri" target="_blank" rel="noopener noreferrer">
          Code on GitHub
        </a>
        <a href="/results.json">Raw numbers as JSON</a>
        <a href="https://doi.org/10.1162/jocn.2007.19.9.1498" target="_blank" rel="noopener noreferrer">
          OASIS dataset paper
        </a>
      </nav>
      <p className="small" style={{ color: "var(--muted)" }}>
        MIT licence. Last updated October 2026. Type is Erode by Indian Type Foundry, under the
        ITF Free Font License, served from this site.
      </p>
    </footer>
  );
}
