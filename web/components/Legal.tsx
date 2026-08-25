import React from "react";

export const UPDATED = "24 August 2026";

export function LegalPage({ title, summary, children }: {
  title: string; summary: string; children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-wide px-5">
      <header className="border-b border-rule py-12">
        <p className="mb-3 font-mono text-[0.75rem] uppercase tracking-[0.12em] text-muted">
          Site policies
        </p>
        <h1 className="max-w-3xl text-[2rem] font-semibold leading-tight sm:text-[2.5rem]">
          {title}
        </h1>
        <p className="p-lede mt-5 max-w-prose">{summary}</p>
        <p className="mt-4 text-[0.8125rem] text-muted">Last updated {UPDATED}.</p>
      </header>
      <div className="max-w-prose py-10">{children}</div>
    </div>
  );
}

export function Clause({ n, title, children }: {
  n: number; title: string; children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule py-7 first:pt-0">
      <h2 className="mb-3 text-[1.125rem] font-semibold">
        <span className="secnum">{n}</span>
        {title}
      </h2>
      <div className="space-y-3 [&>p]:p-body [&>ul]:space-y-2">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 p-body">
          <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
