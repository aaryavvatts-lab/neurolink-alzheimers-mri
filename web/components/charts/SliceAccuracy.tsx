"use client";

import { Chart } from "../ui";
import { C, DataTable, pct } from "./primitives";

interface Pt { slice: number; accuracy: number; n: number }

export default function SliceAccuracy({ points }: { points: Pt[] }) {
  if (points.length < 5) return null;
  const W = 620, H = 230, PAD = { t: 14, r: 14, b: 44, l: 46 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const xs = points.map((p) => p.slice);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const ys = points.map((p) => p.accuracy);
  const lo = Math.max(0, Math.min(...ys) - 0.05), hi = Math.min(1, Math.max(...ys) + 0.05);
  const X = (v: number) => PAD.l + ((v - x0) / (x1 - x0 || 1)) * iw;
  const Y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * ih;

  const best = points.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));

  return (
    <Chart
      title="Does it matter where in the head the slice was taken?"
      note="Slice 100 sits low, near the eyes and skull base. Slice 160 sits higher, above the ventricles."
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label="Accuracy plotted against slice position through the head.">
        {[0, 0.5, 1].map((f) => {
          const v = lo + f * (hi - lo);
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke={C.grid} />
              <text x={PAD.l - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={C.muted}>
                {Math.round(v * 100)}
              </text>
            </g>
          );
        })}
        <path d={points.map((p, i) => `${i ? "L" : "M"}${X(p.slice)},${Y(p.accuracy)}`).join(" ")}
              fill="none" stroke={C.steel} strokeWidth={1.75} />
        <circle cx={X(best.slice)} cy={Y(best.accuracy)} r={4.5} fill={C.forest} />
        <text x={X(best.slice)} y={Y(best.accuracy) - 10} textAnchor="middle" fontSize={11} fill={C.forest}>
          best at slice {best.slice}
        </text>
        {[x0, Math.round((x0 + x1) / 2), x1].map((v) => (
          <text key={v} x={X(v)} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill={C.muted}>
            {v}
          </text>
        ))}
        <text x={PAD.l + iw / 2} y={H - 6} textAnchor="middle" fontSize={11.5} fill={C.body}>
          slice number, low in the head to high
        </text>
      </svg>
      <DataTable caption="Accuracy by slice position" head={["Slice", "Accuracy", "Slices scored"]}
                 rows={points.map((p) => [p.slice, pct(p.accuracy, 1), p.n])} />
    </Chart>
  );
}
