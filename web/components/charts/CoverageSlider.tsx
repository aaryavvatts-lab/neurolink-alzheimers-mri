"use client";

import { useState } from "react";
import { Chart } from "../ui";
import { C, DataTable, pct } from "./primitives";

interface Pt { coverage: number; accuracy: number; min_confidence: number }

export default function CoverageSlider({ points, total }: { points: Pt[]; total: number }) {
  const [i, setI] = useState(points.length - 1);
  const cur = points[i];
  const W = 560, H = 220, PAD = { t: 14, r: 14, b: 40, l: 46 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const xs = points.map((p) => p.coverage);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const ys = points.map((p) => p.accuracy);
  const lo = Math.max(0, Math.min(...ys) - 0.05), hi = Math.min(1, Math.max(...ys) + 0.05);
  const X = (v: number) => PAD.l + ((v - x0) / (x1 - x0 || 1)) * iw;
  const Y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * ih;

  const ruledOn = Math.round(cur.coverage * total);

  return (
    <Chart
      title="What happens if the model is allowed to say 'I don't know'"
      note="Drag the slider. The model keeps the cases it is most sure about and hands the rest to a person."
    >
      <div className="space-y-4">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
             aria-label="Accuracy as a function of how many patients the model rules on.">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
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
          <path
            d={points.map((p, k) => `${k ? "L" : "M"}${X(p.coverage)},${Y(p.accuracy)}`).join(" ")}
            fill="none" stroke={C.steel} strokeWidth={2}
          />
          <line x1={X(cur.coverage)} x2={X(cur.coverage)} y1={PAD.t} y2={PAD.t + ih}
                stroke={C.ink} strokeDasharray="3 3" />
          <circle cx={X(cur.coverage)} cy={Y(cur.accuracy)} r={5} fill={C.ink} stroke="#fff" strokeWidth={1.5} />
          {[0.25, 0.5, 0.75, 1].map((v) => (
            <text key={v} x={X(v)} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill={C.muted}>
              {v * 100}%
            </text>
          ))}
          <text x={PAD.l + iw / 2} y={H - 6} textAnchor="middle" fontSize={11.5} fill={C.body}>
            share of patients the model rules on
          </text>
        </svg>

        <label className="block">
          <span className="mb-2 block text-[0.875rem] text-body">
            Model rules on{" "}
            <strong className="tnum font-medium text-ink">{pct(cur.coverage, 0)}</strong> of patients
            ({ruledOn} of {total})
          </span>
          <input
            type="range" min={0} max={points.length - 1} value={i}
            onChange={(e) => setI(Number(e.target.value))}
            aria-label="How many patients the model rules on"
            aria-valuetext={`${pct(cur.coverage, 0)} coverage, ${pct(cur.accuracy, 0)} accuracy`}
            className="w-full accent-[#1D5B8F]"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-t-2 border-rule pt-2">
            <p className="tnum font-serif text-[1.5rem] font-semibold text-ink">{pct(cur.accuracy, 1)}</p>
            <p className="text-[0.8125rem] text-body">correct on the cases it keeps</p>
          </div>
          <div className="border-t-2 border-rule pt-2">
            <p className="tnum font-serif text-[1.5rem] font-semibold text-ink">{total - ruledOn}</p>
            <p className="text-[0.8125rem] text-body">patients sent to a clinician instead</p>
          </div>
          <div className="border-t-2 border-rule pt-2">
            <p className="tnum font-serif text-[1.5rem] font-semibold text-ink">
              {cur.min_confidence.toFixed(2)}
            </p>
            <p className="text-[0.8125rem] text-body">lowest confidence it still acts on</p>
          </div>
        </div>
      </div>

      <DataTable
        caption="Accuracy by coverage"
        head={["Share ruled on", "Accuracy"]}
        rows={points.map((p) => [pct(p.coverage, 0), pct(p.accuracy, 1)])}
      />
    </Chart>
  );
}
