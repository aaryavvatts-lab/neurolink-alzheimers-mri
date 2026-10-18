"use client";

import React from "react";

/* Shared page furniture. `eyebrow` and `n` are still accepted so older pages compile, but
   neither is rendered: no kicker labels and no decorative section numbers. */
export function Page({ title, lede, children }: {
  eyebrow?: string; title: string; lede?: string; children: React.ReactNode;
}) {
  return (
    <div className="wrap mx-auto max-w-wide">
      <header className="page-head">
        <h1 className="display lines">
          <span className="line"><span data-line style={{ ["--i" as string]: 0 }}>{title}</span></span>
        </h1>
        {lede && <p className="lead" data-rise style={{ ["--i" as string]: 1 }}>{lede}</p>}
      </header>
      {children}
    </div>
  );
}

export function Section({ id, title, children }: {
  n?: string; id?: string; title: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="sect">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="prose-col space-y-4 [&>p]:p-body">{children}</div>;
}

export function Callout({ tone = "note", title, children }: {
  tone?: "note" | "warn" | "good"; title?: string; children: React.ReactNode;
}) {
  return (
    <div className={`callout ${tone}`}>
      {title && <p className="t">{title}</p>}
      <div className="p-body">{children}</div>
    </div>
  );
}

export function Stat({ value, label, note, tone = "ink" }: {
  value: string; label: string; note?: string; tone?: "ink" | "brick" | "forest" | "steel";
}) {
  const c = { ink: "text-ink", brick: "text-brick", forest: "text-forest", steel: "text-steel" }[tone];
  return (
    <div className="stat">
      <p className={`n ${c}`}>{value}</p>
      <p className="k">{label}</p>
      {note && <p className="note">{note}</p>}
    </div>
  );
}

export function Figure({ src, caption, alt }: { src: string; caption: string; alt?: string }) {
  const [ok, setOk] = React.useState(true);
  if (!ok) return null;
  return (
    <figure className="fig">
      <div className="scroll-x p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? caption} className="w-full min-w-[520px]" loading="lazy" decoding="async" onError={() => setOk(false)} />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function Chart({ title, note, children, tools }: {
  title: string; note?: string; children: React.ReactNode; tools?: React.ReactNode;
}) {
  return (
    <figure className="fig fig--chart">
      <figcaption>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-body font-medium text-ink">{title}</span>
          {tools}
        </div>
        {note && <p className="mt-1">{note}</p>}
      </figcaption>
      <div className="scroll-x px-4 pb-4">{children}</div>
    </figure>
  );
}

export function Toggle<T extends string>({ options, value, onChange, label }: {
  options: [T, string][]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1">
      {options.map(([v, text]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v} className="chip text-small">
          {text}
        </button>
      ))}
    </div>
  );
}

export function Ref({ n }: { n: number }) {
  return (
    <a href={`/references#r${n}`} className="refsup" aria-label={`Reference ${n}`}>[{n}]</a>
  );
}
