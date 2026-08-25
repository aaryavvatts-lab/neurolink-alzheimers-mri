"use client";

import { useState } from "react";
import { Chart, Toggle } from "../ui";
import { C, DataTable, pct } from "./primitives";
import type { Results } from "@/lib/types";

type Metric = "accuracy" | "balanced_accuracy";

export default function LeakageBars({ r }: { r: Results }) {
  const [metric, setMetric] = useState<Metric>("balanced_accuracy");
  const lk = r.leakage_experiment;
  if (!lk) return null;

  const bars = [
    {
      key: "leaky",
      label: "Split by slice",
      sub: "the usual way",
      value: lk.leaky_random_split[metric],
      color: C.brick,
    },
    {
      key: "slice",
      label: "Split by patient",
      sub: "scored per slice",
      value: lk.honest_subject_split_slice_level[metric],
      color: C.steel,
    },
    {
      key: "subject",
      label: "Split by patient",
      sub: "scored per patient",
      value: lk.honest_subject_split_subject_level[metric],
      color: C.steel,
    },
  ];

  const W = 620, H = 260, PAD = { t: 16, r: 16, b: 52, l: 44 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const bw = iw / bars.length;
  const chance = metric === "balanced_accuracy" ? 0.25 : null;

  return (
    <Chart
      title="Same model, same training, different split"
      note="The only thing that changes between these bars is which side of the train and test line each slice landed on."
      tools={
        <Toggle
          label="Choose metric"
          value={metric}
          onChange={setMetric}
          options={[
            ["balanced_accuracy", "Balanced accuracy"],
            ["accuracy", "Plain accuracy"],
          ]}
        />
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label="Bar chart comparing scores under a slice split and a patient split.">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih * (1 - v)} y2={PAD.t + ih * (1 - v)}
                  stroke={C.grid} />
            <text x={PAD.l - 8} y={PAD.t + ih * (1 - v) + 4} textAnchor="end" fontSize={11} fill={C.muted}>
              {v * 100}
            </text>
          </g>
        ))}

        {chance !== null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih * (1 - chance)} y2={PAD.t + ih * (1 - chance)}
                  stroke={C.muted} strokeDasharray="4 3" />
            <text x={W - PAD.r} y={PAD.t + ih * (1 - chance) - 6} textAnchor="end" fontSize={11} fill={C.muted}>
              guessing at random
            </text>
          </g>
        )}

        {bars.map((b, i) => {
          const h = ih * b.value;
          const x = PAD.l + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const y = PAD.t + ih - h;
          return (
            <g key={b.key}>
              <rect x={x} y={y} width={w} height={h} fill={b.color} />
              <text x={x + w / 2} y={y - 8} textAnchor="middle" fontSize={14}
                    fontWeight={600} fill={C.ink} className="tnum">
                {pct(b.value)}
              </text>
              <text x={x + w / 2} y={PAD.t + ih + 18} textAnchor="middle" fontSize={12} fill={C.body}>
                {b.label}
              </text>
              <text x={x + w / 2} y={PAD.t + ih + 34} textAnchor="middle" fontSize={11} fill={C.muted}>
                {b.sub}
              </text>
            </g>
          );
        })}
      </svg>

      <DataTable
        caption="Scores by splitting method"
        head={["Split", "Scored at", "Score"]}
        rows={bars.map((b) => [b.label, b.sub, pct(b.value)])}
      />
    </Chart>
  );
}
