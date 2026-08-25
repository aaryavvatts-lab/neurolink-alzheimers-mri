"use client";

import { useMemo, useState } from "react";
import { Chart } from "../ui";
import { C, DataTable, pct } from "./primitives";

interface Pt { fpr: number; tpr: number; threshold: number | null }

export default function RocCurve({ points, auc, n }: {
  points: Pt[]; auc: number | null; n: number;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 420, H = 380, PAD = { t: 14, r: 14, b: 44, l: 48 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const X = (v: number) => PAD.l + v * iw;
  const Y = (v: number) => PAD.t + (1 - v) * ih;

  const path = useMemo(
    () => points.map((p, i) => `${i ? "L" : "M"}${X(p.fpr).toFixed(1)},${Y(p.tpr).toFixed(1)}`).join(" "),
    [points] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!points.length) return null;
  const cur = sel !== null ? points[sel] : null;

  return (
    <Chart
      title="Catching dementia versus false alarms"
      note={`Each point is one cut-off for calling a scan abnormal. Measured on ${n} held-out patients.`}
      tools={
        <span className="tnum text-[0.8125rem] text-muted">
          area under curve {auc === null ? "not measurable" : auc.toFixed(3)}
        </span>
      }
    >
      <div className="flex flex-wrap items-start gap-6">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} className="max-w-full" role="img"
             aria-label="Receiver operating characteristic curve.">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke={C.grid} />
              <text x={PAD.l - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={C.muted}>{v * 100}</text>
              <text x={X(v)} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill={C.muted}>{v * 100}</text>
            </g>
          ))}
          <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke={C.muted} strokeDasharray="4 3" />
          <text x={X(0.62)} y={Y(0.52)} fontSize={11} fill={C.muted} transform={`rotate(-32 ${X(0.62)} ${Y(0.52)})`}>
            a coin flip
          </text>

          <path d={path} fill="none" stroke={C.steel} strokeWidth={2} />

          {points.map((p, i) => (
            <circle
              key={i} cx={X(p.fpr)} cy={Y(p.tpr)} r={sel === i ? 5 : 3.2}
              fill={sel === i ? C.ink : C.steel} stroke="#fff" strokeWidth={1}
              tabIndex={0} role="button"
              aria-label={`Cut-off ${p.threshold?.toFixed(2) ?? ""}: catches ${pct(p.tpr, 0)} of dementia, ${pct(p.fpr, 0)} false alarms`}
              onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)}
              onMouseLeave={() => setSel(null)} onBlur={() => setSel(null)}
              style={{ cursor: "pointer" }}
            />
          ))}

          <text x={PAD.l + iw / 2} y={H - 6} textAnchor="middle" fontSize={11.5} fill={C.body}>
            false alarms among healthy patients (%)
          </text>
          <text x={12} y={PAD.t + ih / 2} textAnchor="middle" fontSize={11.5} fill={C.body}
                transform={`rotate(-90 12 ${PAD.t + ih / 2})`}>
            dementia cases caught (%)
          </text>
        </svg>

        <div className="min-w-[190px] flex-1 border-l border-rule pl-5 text-[0.875rem]">
          {cur ? (
            <>
              <p className="text-muted">At this cut-off:</p>
              <p className="mt-2 tnum text-[1.5rem] font-semibold text-forest">{pct(cur.tpr, 0)}</p>
              <p className="text-[0.8125rem] text-body">of patients with dementia are caught</p>
              <p className="mt-3 tnum text-[1.5rem] font-semibold text-brick">{pct(cur.fpr, 0)}</p>
              <p className="text-[0.8125rem] text-body">of healthy patients are wrongly flagged</p>
            </>
          ) : (
            <p className="text-muted">
              Hover a point, or tab to it, to see what that cut-off would mean in practice.
              Moving up the curve catches more illness but flags more healthy people.
            </p>
          )}
        </div>
      </div>

      <DataTable
        caption="Points on the curve"
        head={["False alarm rate", "Cases caught"]}
        rows={points.map((p) => [pct(p.fpr, 1), pct(p.tpr, 1)])}
      />
    </Chart>
  );
}
