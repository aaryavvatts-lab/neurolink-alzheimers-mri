"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { TOOLS, READ, LEGAL } from "@/lib/nav";

const BAR: [string, string][] = [
  ["/findings", "Findings"],
  ["/results", "Results"],
  ["/try", "Run the model"],
  ["/check", "Check your data"],
];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close on route change, on Escape, and when the screen grows past phone width.
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) { document.body.style.overflow = ""; return; }
    document.body.style.overflow = "hidden";
    const first = sheetRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
      if (e.key === "Tab" && sheetRef.current) {
        const f = sheetRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    const mq = window.matchMedia("(min-width: 48em)");
    const onWide = (m: MediaQueryListEvent) => { if (m.matches) setOpen(false); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
      document.body.style.overflow = "";
    };
  }, [open]);

  const cur = (href: string) => (path === href ? "page" : undefined);
  let i = 0;

  return (
    <>
      <header className="wrap bar">
        <Link href="/" className="bar__mark">SliceWise</Link>
        <nav className="bar__links" aria-label="Site">
          {BAR.map(([href, name]) => (
            <Link key={href} href={href} aria-current={cur(href)}>{name}</Link>
          ))}
          <ThemeToggle />
        </nav>
        <div className="bar__phone">
          <ThemeToggle />
          <button
            ref={toggleRef}
            type="button"
            className="textbtn"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu"
          >
            Menu
          </button>
        </div>
      </header>

      <nav id="menu" ref={sheetRef} className="sheet" hidden={!open} aria-label="Menu">
        <div className="sheet__top">
          <span className="bar__mark">SliceWise</span>
          <button type="button" className="textbtn" onClick={() => { setOpen(false); toggleRef.current?.focus(); }}>
            Close
          </button>
        </div>
        <div className="sheet__cols">
          <div>
            <p>Tools</p>
            {TOOLS.map(([href, name]) => (
              <Link key={href} href={href} aria-current={cur(href)} style={{ ["--i" as string]: i++ }}>{name}</Link>
            ))}
          </div>
          <div>
            <p>Read</p>
            <Link href="/" aria-current={cur("/")} style={{ ["--i" as string]: i++ }}>Home</Link>
            {READ.map(([href, name]) => (
              <Link key={href} href={href} aria-current={cur(href)} style={{ ["--i" as string]: i++ }}>{name}</Link>
            ))}
            <p style={{ marginTop: "1.2rem" }}>Policies</p>
            {LEGAL.map(([href, name]) => (
              <Link key={href} href={href} aria-current={cur(href)} style={{ ["--i" as string]: i++ }}>{name}</Link>
            ))}
          </div>
        </div>
        <p className="small" style={{ color: "var(--muted)" }}>
          A student project. Not a medical tool.
        </p>
      </nav>
    </>
  );
}
