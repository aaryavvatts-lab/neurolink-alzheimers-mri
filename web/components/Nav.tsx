"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS: [string, string][] = [
  ["/", "Project"],
  ["/try", "Try it"],
  ["/explore", "Explore"],
  ["/check", "Check your data"],
  ["/results", "Results"],
  ["/method", "Method"],
  ["/references", "References"],
];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex max-w-wide items-center gap-5 px-5 py-3">
        <Link href="/" className="font-serif text-[1.05rem] font-semibold text-ink">
          NeuroLink
        </Link>

        <ul className="ml-auto hidden items-center gap-0.5 lg:flex">
          {LINKS.map(([href, label]) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded px-2.5 py-1.5 text-[0.8125rem] whitespace-nowrap ${
                    active ? "bg-ink text-white" : "text-body hover:bg-rule/50"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="ml-auto rounded border border-rule px-3 py-1.5 text-[0.875rem] lg:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </nav>

      {open && (
        <ul id="mobile-nav" className="border-t border-rule px-5 pb-3 lg:hidden">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className="block py-2 text-[0.95rem] text-body"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
