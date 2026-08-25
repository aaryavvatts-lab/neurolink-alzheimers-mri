import Link from "next/link";

const LEGAL: [string, string][] = [
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/cookies", "Cookies"],
  ["/accessibility", "Accessibility"],
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-rule bg-white">
      <div className="mx-auto max-w-wide px-5 py-10">
        <div className="mb-6 border-l-2 border-brick pl-4">
          <p className="text-[0.875rem] leading-relaxed text-body">
            <strong className="font-medium text-ink">This is a student project, not a medical tool.</strong>{" "}
            Nothing here is approved by any regulator, and nothing here should be used to
            decide anything about a real person. If you are worried about memory problems,
            please speak to a doctor.
          </p>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="font-serif text-[1rem] text-ink">NeuroLink</p>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              Built on the OASIS brain MRI collection. The model runs in your browser.
              No scan you open here is sent anywhere.
            </p>
          </div>

          <nav aria-label="Legal and site policies">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem]">
              {LEGAL.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-muted hover:text-ink hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-8 text-[0.75rem] text-muted">
          Code released under the MIT licence. Last updated August 2026.
        </p>
      </div>
    </footer>
  );
}
