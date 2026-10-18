import React from "react";

export const UPDATED = "18 October 2026";

export function LegalPage({ title, summary, children }: {
  title: string; summary: string; children: React.ReactNode;
}) {
  return (
    <div className="wrap mx-auto max-w-wide">
      <header className="page-head">
        <h1 className="display">{title}</h1>
        <p className="lead">{summary}</p>
        <p className="small mt-4" style={{ color: "var(--muted)" }}>Last updated {UPDATED}.</p>
      </header>
      <div className="max-w-prose pb-10">{children}</div>
    </div>
  );
}

export function Clause({ title, children }: {
  n?: number; title: string; children: React.ReactNode;
}) {
  return (
    <section className="sect" style={{ paddingBlock: "1.6rem" }}>
      <h2>{title}</h2>
      <div className="space-y-3 [&>p]:p-body [&>ul]:space-y-2">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((it, i) => (
        <li key={i} className="p-body">{it}</li>
      ))}
    </ul>
  );
}
