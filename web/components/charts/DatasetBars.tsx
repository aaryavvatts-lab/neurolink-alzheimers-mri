"use client";

import { useState } from "react";
import { Chart, Toggle } from "../ui";
import { C, DataTable, STAGE } from "./primitives";
import type { Results } from "@/lib/types";

export default function DatasetBars({ r }: { r: Results }) {
  const [mode, setMode] = useState<"images" | "subjects">("images");
  const cls = r.dataset.classes;
  const vals = cls.map((c) => (mode === "images" ? c.images : c.subjects));
  const max = Math.max(...vals);

  const W = 620, H = 250, PAD = { t: 18, r: 16, b: 54, l: 60 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const bw = iw / cls.length;

  return (
    <Chart
      title="How big is this dataset really?"
      note="Switch between counting picture files and counting the people those files came from."
      tools={
        <Toggle label="Count by" value={mode} onChange={setMode}
                options={[["images", "Image files"], ["subjects", "People"]]} />
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label={`Bar chart of ${mode === "images" ? "image counts" : "patient counts"} per stage.`}>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih * (1 - f)} y2={PAD.t + ih * (1 - f)}
                stroke={C.grid} />
        ))}
        {cls.map((c, i) => {
          const v = mode === "images" ? c.images : c.subjects;
          const h = (v / max) * ih;
          const x = PAD.l + i * bw + bw * 0.2;
          const w = bw * 0.6;
          return (
            <g key={c.name}>
              <rect x={x} y={PAD.t + ih - h} width={w} height={Math.max(h, 1.5)} fill={STAGE[i]} />
              <text x={x + w / 2} y={PAD.t + ih - h - 8} textAnchor="middle" fontSize={13}
                    fontWeight={600} fill={C.ink} className="tnum">
                {v.toLocaleString()}
              </text>
              <text x={x + w / 2} y={PAD.t + ih + 18} textAnchor="middle" fontSize={11.5} fill={C.body}>
                {c.short}
              </text>
              <text x={x + w / 2} y={PAD.t + ih + 34} textAnchor="middle" fontSize={10.5} fill={C.muted}>
                CDR {c.cdr}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[0.8125rem] text-muted">
        {mode === "images"
          ? "Counted this way the dataset looks large and only a little lopsided."
          : "Counted this way, one of the four groups has two people in it."}
      </p>
      <DataTable caption="Dataset size by stage" head={["Stage", "CDR", "Images", "People"]}
                 rows={cls.map((c) => [c.name, c.cdr, c.images, c.subjects])} />
    </Chart>
  );
}
