"use client";

import { useState } from "react";
import { Chart, Toggle } from "../ui";
import { C, DataTable, pct } from "./primitives";
import type { Results } from "@/lib/types";

type Metric = "balanced" | "auc";

interface Row { label: string; note: string; balanced: number; auc: number | null; tone: string }

export default function ModelCompare({ r }: { r: Results }) {
  const [metric, setMetric] = useState<Metric>("balanced");

  const rows: Row[] = [];
  const push = (label: string, note: string, bal?: number, auc?: number | null, tone = C.steel) => {
    if (bal === undefined) return;
    rows.push({ label, note, balanced: bal, auc: auc ?? null, tone });
  };

  const scratch = r.runs["scratch_cnn_holdout"];
  const resnet = r.runs["leakage_honest_subject_split"];
  const probe = r.runs["probe_brain_removed"];
  const ruler = r.ventricle_baseline;

  push("Small network, trained from scratch", "2.4 million numbers",
       scratch?.subject_level.balanced_accuracy,
       scratch?.subject_level.binary_screening.roc_auc, C.forest);
  push("ResNet-18, pretrained on photographs", "11.2 million numbers",
       resnet?.subject_level.balanced_accuracy,
       resnet?.subject_level.binary_screening.roc_auc, C.steel);
  push("Eight measurements and a plain fit", "the ruler",
       ruler?.subject_level.balanced_accuracy,
       ruler?.subject_level.binary_screening.roc_auc, C.amber);
  push("Same network, brain erased", "should be near guessing",
       probe?.subject_level.balanced_accuracy,
       probe?.subject_level.binary_screening.roc_auc, C.brick);

  if (rows.length < 2) return null;

  const val = (row: Row) => (metric === "balanced" ? row.balanced : row.auc ?? 0);
  const floor = metric === "balanced" ? 0.25 : 0.5;
  const max = Math.max(...rows.map(val), floor + 0.1);

  const W = 620, H = 42 * rows.length + 54, PAD = { t: 10, r: 90, b: 34, l: 250 };
  const iw = W - PAD.l - PAD.r;
  const X = (v: number) => PAD.l + (v / max) * iw;

  return (
    <Chart
      title="Everything measured the same way, on the same patients"
      note="All four are scored per patient on the same held-out people, using the same split."
      tools={
        <Toggle label="Choose metric" value={metric} onChange={setMetric}
                options={[["balanced", "Four stages"], ["auc", "Dementia or not"]]} />
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label="Bar chart comparing four approaches on the same patients.">
        <line x1={X(floor)} x2={X(floor)} y1={PAD.t} y2={H - PAD.b}
              stroke={C.muted} strokeDasharray="4 3" />
        <text x={X(floor)} y={H - PAD.b + 16} textAnchor="middle" fontSize={10.5} fill={C.muted}>
          {metric === "balanced" ? "guessing" : "a coin flip"}
        </text>

        {rows.map((row, i) => {
          const y = PAD.t + i * 42;
          const v = val(row);
          return (
            <g key={row.label}>
              <text x={PAD.l - 12} y={y + 15} textAnchor="end" fontSize={12} fill={C.ink}>
                {row.label}
              </text>
              <text x={PAD.l - 12} y={y + 29} textAnchor="end" fontSize={10.5} fill={C.muted}>
                {row.note}
              </text>
              <rect x={PAD.l} y={y + 6} width={Math.max(X(v) - PAD.l, 2)} height={22}
                    fill={row.tone} />
              <text x={X(v) + 8} y={y + 22} fontSize={13} fontWeight={600} fill={C.ink}
                    className="tnum">
                {metric === "balanced" ? pct(v, 1) : v.toFixed(3)}
              </text>
            </g>
          );
        })}
      </svg>

      <DataTable
        caption="Comparison of approaches"
        head={["Approach", "Four-stage balanced accuracy", "Dementia or not, area under curve"]}
        rows={rows.map((row) => [row.label, pct(row.balanced, 1),
                                 row.auc === null ? "not measurable" : row.auc.toFixed(3)])}
      />
    </Chart>
  );
}
