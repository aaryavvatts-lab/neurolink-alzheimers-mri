"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { TOOLS, READ } from "@/lib/nav";

function Dropdown({ label, items, path }: {
  label: string; items: [string, string, string][]; path: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = items.some(([h]) => path.startsWith(h));

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`rounded px-2.5 py-1.5 text-[0.8125rem] ${
          active ? "bg-ink text-white" : "text-body hover:bg-rule/50"
        }`}
      >
        {label}
        <span aria-hidden="true" className="ml-1.5 text-[0.625rem]">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[19rem] border border-rule bg-white shadow-sm">
          <ul>
            {items.map(([href, name, desc]) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-rule/60 px-4 py-3 last:border-0 hover:bg-paper"
                >
                  <span className="block text-[0.875rem] text-ink">{name}</span>
                  <span className="mt-0.5 block text-[0.75rem] leading-snug text-muted">{desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex max-w-wide items-center gap-4 px-5 py-3">
        <Link href="/" className="font-serif text-[1.05rem] font-semibold text-ink">
          NeuroLink
        </Link>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          <Dropdown label="Tools" items={TOOLS} path={path} />
          <Dropdown label="Read" items={READ} path={path} />
          <Link
            href="/check"
            className="ml-2 border border-ink px-3 py-1.5 text-[0.8125rem] text-ink hover:bg-ink hover:text-white"
          >
            Check your data
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="ml-auto rounded border border-rule px-3 py-1.5 text-[0.875rem] md:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </nav>

      {open && (
        <div id="mobile-nav" className="border-t border-rule bg-white px-5 py-4 md:hidden">
          {([["Tools", TOOLS], ["Read", READ]] as const).map(([label, items]) => (
            <div key={label} className="mb-4 last:mb-0">
              <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
                {label}
              </p>
              <ul className="space-y-1">
                {items.map(([href, name]) => (
                  <li key={href}>
                    <Link href={href} onClick={() => setOpen(false)}
                          className="block py-1.5 text-[0.9375rem] text-body">
                      {name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
