"use client";

import React from "react";

export function Page({ eyebrow, title, lede, children }: {
  eyebrow?: string; title: string; lede?: string; children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-wide px-5">
      <header className="border-b border-rule py-12 sm:py-16">
        {eyebrow && (
          <p className="mb-3 font-mono text-[0.75rem] uppercase tracking-[0.12em] text-muted">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-3xl text-[2rem] font-semibold leading-[1.15] sm:text-[2.75rem]">
          {title}
        </h1>
        {lede && <p className="p-lede mt-5 max-w-prose">{lede}</p>}
      </header>
      {children}
    </div>
  );
}

export function Section({ n, id, title, children }: {
  n?: string; id?: string; title: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-rule py-12">
      <h2 className="mb-6 text-[1.4rem] font-semibold leading-snug sm:text-[1.6rem]">
        {n && <span className="secnum">{n}</span>}
        {title}
      </h2>
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
  const border = { note: "border-steel", warn: "border-brick", good: "border-forest" }[tone];
  return (
    <div className={`border-l-2 ${border} bg-white/60 px-4 py-3`}>
      {title && <p className="mb-1 text-[0.875rem] font-medium text-ink">{title}</p>}
      <div className="text-[0.9375rem] leading-relaxed text-body">{children}</div>
    </div>
  );
}

export function Stat({ value, label, note, tone = "ink" }: {
  value: string; label: string; note?: string; tone?: "ink" | "brick" | "forest" | "steel";
}) {
  const c = { ink: "text-ink", brick: "text-brick", forest: "text-forest", steel: "text-steel" }[tone];
  return (
    <div className="border-t-2 border-rule pt-3">
      <p className={`font-serif text-[1.75rem] font-semibold leading-none tnum ${c}`}>{value}</p>
      <p className="mt-2 text-[0.8125rem] leading-snug text-body">{label}</p>
      {note && <p className="mt-1 text-[0.75rem] leading-snug text-muted">{note}</p>}
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
        <img src={src} alt={alt ?? caption} className="w-full min-w-[520px]" onError={() => setOk(false)} />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function Chart({ title, note, children, tools }: {
  title: string; note?: string; children: React.ReactNode; tools?: React.ReactNode;
}) {
  return (
    <figure className="fig">
      <figcaption className="border-b border-t-0 border-rule px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-sans text-[0.9375rem] font-medium text-ink">{title}</span>
          {tools}
        </div>
        {note && <p className="mt-1 text-[0.8125rem] text-muted">{note}</p>}
      </figcaption>
      <div className="scroll-x p-4">{children}</div>
    </figure>
  );
}

export function Toggle<T extends string>({ options, value, onChange, label }: {
  options: [T, string][]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded border border-rule bg-white">
      {options.map(([v, text], i) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`px-3 py-1 text-[0.8125rem] ${i > 0 ? "border-l border-rule" : ""} ${
            value === v ? "bg-ink text-white" : "text-body hover:bg-rule/40"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function Ref({ n }: { n: number }) {
  return (
    <a href={`/references#r${n}`} className="text-steel no-underline" aria-label={`Reference ${n}`}>
      <sup className="font-mono text-[0.7rem]">[{n}]</sup>
    </a>
  );
}
