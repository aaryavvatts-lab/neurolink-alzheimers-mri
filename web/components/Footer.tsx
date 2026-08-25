import Link from "next/link";
import { TOOLS, READ, LEGAL } from "@/lib/nav";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-rule bg-white">
      <div className="mx-auto max-w-wide px-5 py-12">
        <div className="mb-10 border-l-2 border-brick pl-4">
          <p className="max-w-2xl text-[0.875rem] leading-relaxed text-body">
            <strong className="font-medium text-ink">This is a student project, not a medical tool.</strong>{" "}
            Nothing here is approved by any regulator, and nothing here should be used to decide
            anything about a real person. If you are worried about memory problems, please speak
            to a doctor.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
              Tools
            </p>
            <ul className="space-y-1.5">
              {TOOLS.map(([href, name]) => (
                <li key={href}>
                  <Link href={href} className="text-[0.8125rem] text-body hover:text-ink hover:underline">
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
              Read
            </p>
            <ul className="space-y-1.5">
              {READ.map(([href, name]) => (
                <li key={href}>
                  <Link href={href} className="text-[0.8125rem] text-body hover:text-ink hover:underline">
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
              Policies
            </p>
            <ul className="space-y-1.5">
              {LEGAL.map(([href, name]) => (
                <li key={href}>
                  <Link href={href} className="text-[0.8125rem] text-body hover:text-ink hover:underline">
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
              Source
            </p>
            <ul className="space-y-1.5 text-[0.8125rem] text-body">
              <li>
                <a href="https://github.com/aaryavvatts-lab/neurolink-alzheimers-mri"
                   target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
                  Code on GitHub
                </a>
              </li>
              <li>
                <a href="/results.json" className="hover:text-ink hover:underline">
                  Raw numbers as JSON
                </a>
              </li>
              <li>
                <a href="https://doi.org/10.1162/jocn.2007.19.9.1498"
                   target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
                  OASIS dataset paper
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6">
          <p className="text-[0.75rem] text-muted">
            Built on the OASIS brain MRI collection. The model runs in your browser, so no scan
            you open here is sent anywhere.
          </p>
          <p className="text-[0.75rem] text-muted">
            MIT licence. Last updated August 2026.
          </p>
        </div>
      </div>
    </footer>
  );
}
