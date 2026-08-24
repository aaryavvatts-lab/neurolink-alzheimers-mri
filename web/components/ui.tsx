"use client";
import React from "react";

export function Section({ id, eyebrow, title, children }: {
  id: string; eyebrow?: string; title: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-14 sm:py-20 scroll-mt-16">
      {eyebrow && (
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      )}
      <h2 className="h2 mb-5">{title}</h2>
      {children}
    </section>
  );
}

export function Stat({ value, label, tone = "default", sub }: {
  value: string; label: string; tone?: "default" | "warn" | "good"; sub?: string;
}) {
  const c = tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : "text-white";
  return (
    <div className="card p-4">
      <div className={`text-2xl sm:text-3xl font-semibold tabular-nums ${c}`}>{value}</div>
      <div className="mt-1 text-xs text-muted leading-snug">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "good" }) {
  const map = {
    info: "border-accent/30 bg-accent/5 text-slate-300",
    warn: "border-warn/30 bg-warn/5 text-red-200",
    good: "border-good/30 bg-good/5 text-emerald-200",
  }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${map}`}>{children}</div>;
}

/** Renders a generated figure, and disappears if that figure does not exist.
 *  Report steps are optional, so a missing PNG must not leave a broken image. */
export function Figure({ src, caption }: { src: string; caption: string }) {
  const [ok, setOk] = React.useState(true);
  if (!ok) return null;
  return (
    <figure className="card overflow-hidden">
      <div className="bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={caption} className="w-full" onError={() => setOk(false)} />
      </div>
      <figcaption className="px-4 py-3 text-xs leading-relaxed text-muted">{caption}</figcaption>
    </figure>
  );
}

export function ConfusionMatrix({ cm, names, caption }: {
  cm: number[][]; names: string[]; caption?: string;
}) {
  const rowSums = cm.map((r) => r.reduce((a, b) => a + b, 0));
  return (
    <div>
      <div className="scroll-x">
        <table className="w-full min-w-[380px] text-center text-xs">
          <thead>
            <tr className="text-muted">
              <th className="p-2 text-left font-normal">true \ pred</th>
              {names.map((n) => <th key={n} className="p-2 font-normal">{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {cm.map((row, i) => (
              <tr key={i}>
                <td className="p-2 text-left text-muted whitespace-nowrap">{names[i]}</td>
                {row.map((v, j) => {
                  const frac = rowSums[i] ? v / rowSums[i] : 0;
                  return (
                    <td key={j} className="p-1">
                      <div
                        className="rounded-md py-2 tabular-nums"
                        style={{
                          background: i === j
                            ? `rgba(61,220,151,${0.10 + 0.55 * frac})`
                            : `rgba(255,92,92,${0.06 + 0.5 * frac})`,
                          color: frac > 0.55 ? "#0b1020" : "#e8ecf8",
                        }}
                      >
                        <div className="font-semibold">{v}</div>
                        <div className="text-[10px] opacity-80">{(frac * 100).toFixed(0)}%</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <p className="mt-2 text-[11px] text-muted">{caption}</p>}
    </div>
  );
}

export function Bar({ value, max = 1, tone = "accent", label, right }: {
  value: number | null; max?: number; tone?: "accent" | "warn" | "good"; label: string; right?: string;
}) {
  const v = value ?? 0;
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  const bg = tone === "warn" ? "bg-warn" : tone === "good" ? "bg-good" : "bg-accent";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-muted">
          {right ?? (value === null ? "—" : value.toFixed(3))}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-line/60">
        <div className={`h-2 rounded-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
