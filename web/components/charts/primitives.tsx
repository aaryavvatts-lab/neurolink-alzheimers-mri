"use client";

import React from "react";

export const C = {
  ink: "#17181B",
  body: "#33363D",
  muted: "#666C77",
  rule: "#E1DED5",
  steel: "#1D5B8F",
  brick: "#A03027",
  forest: "#2C6E4E",
  amber: "#9C6F13",
  grid: "#EDEAE2",
};

/** Colours for the four Clinical Dementia Rating stages, light to dark. */
export const STAGE = ["#2C6E4E", "#7A8C2E", "#B4761A", "#A03027"];

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
          <text x={t.px} y={y + 16} textAnchor="middle" fontSize={11} fill={C.muted}>
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
          <text x={x - 6} y={t.py + 4} textAnchor="end" fontSize={11} fill={C.muted}>
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
