"use client";

import React from "react";

/* Chart colours are the page's own custom properties, so the SVGs follow the light and dark
   palettes without redrawing. They resolve because the charts are inline SVG in the document. */
export const C = {
  ink: "var(--ink)",
  body: "var(--ink)",
  muted: "var(--muted)",
  rule: "var(--rule)",
  steel: "var(--data)",
  brick: "var(--accent)",
  forest: "var(--good)",
  amber: "var(--warn)",
  grid: "var(--rule)",
};

/** Colours for the four Clinical Dementia Rating stages, light to dark. */
export const STAGE = ["var(--stage-0)", "var(--stage-1)", "var(--stage-2)", "var(--stage-3)"];

export function useScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return React.useCallback(
    (v: number) => (d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)),
    [d0, d1, r0, r1]
  );
}

export function AxisX({ x0, x1, y, ticks, fmt }: {
  x0: number; x1: number; y: number; ticks: { v: number; px: number }[];
  fmt?: (v: number) => string;
}) {
  return (
    <g>
      <line x1={x0} x2={x1} y1={y} y2={y} stroke={C.rule} strokeWidth={1} />
      {ticks.map((t) => (
        <g key={t.v}>
          <line x1={t.px} x2={t.px} y1={y} y2={y + 4} stroke={C.rule} />
          <text x={t.px} y={y + 16} textAnchor="middle" fontSize={13} fill={C.muted}>
            {fmt ? fmt(t.v) : t.v}
          </text>
        </g>
      ))}
    </g>
  );
}

export function AxisY({ y0, y1, x, ticks, fmt }: {
  y0: number; y1: number; x: number; ticks: { v: number; py: number }[];
  fmt?: (v: number) => string;
}) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t.v}>
          <line x1={x} x2={x + 6} y1={t.py} y2={t.py} stroke={C.rule} />
          <text x={x - 6} y={t.py + 4} textAnchor="end" fontSize={13} fill={C.muted}>
            {fmt ? fmt(t.v) : t.v}
          </text>
        </g>
      ))}
      <line x1={x} x2={x} y1={y0} y2={y1} stroke={C.rule} strokeWidth={1} />
    </g>
  );
}

export function GridLines({ x0, x1, ticks }: { x0: number; x1: number; ticks: { py: number }[] }) {
  return (
    <g>
      {ticks.map((t, i) => (
        <line key={i} x1={x0} x2={x1} y1={t.py} y2={t.py} stroke={C.grid} strokeWidth={1} />
      ))}
    </g>
  );
}

/** Table shown to screen readers in place of the SVG. */
export function DataTable({ caption, head, rows }: {
  caption: string; head: string[]; rows: (string | number)[][];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
