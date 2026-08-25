"use client";

import { useMemo, useState } from "react";
import { Callout, Chart, Toggle } from "./ui";
import { C, DataTable } from "./charts/primitives";
import type { Results } from "@/lib/types";

type Mode = "slice" | "patient";

/** Deterministic pseudo-random in [0,1) so the picture is stable between renders. */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function SplitSimulator({ r }: { r: Results }) {
  const [mode, setMode] = useState<Mode>("slice");
  const [nPatients, setNPatients] = useState(12);
  const [slicesEach, setSlicesEach] = useState(8);
  const [testFrac, setTestFrac] = useState(0.25);
  const [seed, setSeed] = useState(3);

  const grid = useMemo(() => {
    const cells: { patient: number; slice: number; test: boolean }[] = [];
    for (let p = 0; p < nPatients; p++) {
      const patientIsTest = rand(seed * 100 + p) < testFrac;
      for (let s = 0; s < slicesEach; s++) {
        const test = mode === "patient"
          ? patientIsTest
          : rand(seed * 10000 + p * 97 + s * 13) < testFrac;
        cells.push({ patient: p, slice: s, test });
      }
    }
    return cells;
  }, [mode, nPatients, slicesEach, testFrac, seed]);

  const stats = useMemo(() => {
    const byPatient = new Map<number, { train: number; test: number }>();
    for (const c of grid) {
      const e = byPatient.get(c.patient) ?? { train: 0, test: 0 };
      if (c.test) e.test++; else e.train++;
      byPatient.set(c.patient, e);
    }
    let split = 0;
    for (const e of byPatient.values()) if (e.train > 0 && e.test > 0) split++;
    return { split, total: byPatient.size, frac: split / byPatient.size };
  }, [grid]);

  const lk = r.leakage_experiment;
  const cell = 15, gap = 3;
  const W = nPatients * (cell + gap) + 130;
  const H = slicesEach * (cell + gap) + 40;

  return (
    <div className="space-y-6">
      <Chart
        title="Every square is one picture. Every column is one patient."
        note="Blue squares go into training, red squares are held back for testing. Change how the split is made and watch what happens to the columns."
        tools={
          <Toggle
            label="How to split"
            value={mode}
            onChange={setMode}
            options={[["slice", "Split the pictures"], ["patient", "Split the patients"]]}
          />
        }
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img"
             aria-label={`Grid showing ${nPatients} patients with ${slicesEach} pictures each, coloured by which side of the split they land on.`}>
          <text x={0} y={12} fontSize={10.5} fill={C.muted}>pictures</text>
          {grid.map((c, i) => {
            const torn = mode === "slice";
            return (
              <rect
                key={i}
                x={130 + c.patient * (cell + gap)}
                y={24 + c.slice * (cell + gap)}
                width={cell} height={cell}
                fill={c.test ? C.brick : C.steel}
                opacity={c.test ? 0.9 : 0.75}
                stroke={torn ? "none" : "none"}
              />
            );
          })}
          <text x={0} y={24 + slicesEach * (cell + gap) + 4} fontSize={10.5} fill={C.muted}>
            patients →
          </text>
          <g>
            <rect x={0} y={34} width={11} height={11} fill={C.steel} opacity={0.75} />
            <text x={16} y={44} fontSize={10.5} fill={C.body}>training</text>
            <rect x={0} y={52} width={11} height={11} fill={C.brick} opacity={0.9} />
            <text x={16} y={62} fontSize={10.5} fill={C.body}>testing</text>
          </g>
        </svg>

        <DataTable
          caption="Patients with pictures on both sides of the split"
          head={["Split method", "Patients torn across the boundary", "Total patients"]}
          rows={[[mode === "slice" ? "Split the pictures" : "Split the patients",
                  stats.split, stats.total]]}
        />
      </Chart>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="border-t-2 pt-3" style={{ borderColor: stats.split ? C.brick : C.forest }}>
          <p className="tnum font-serif text-[1.75rem] font-semibold leading-none"
             style={{ color: stats.split ? C.brick : C.forest }}>
            {stats.split} of {stats.total}
          </p>
          <p className="mt-2 text-[0.8125rem] leading-snug text-body">
            patients with pictures in both piles
          </p>
        </div>
        <div className="border-t-2 border-rule pt-3">
          <p className="tnum font-serif text-[1.75rem] font-semibold leading-none text-ink">
            {(stats.frac * 100).toFixed(0)}%
          </p>
          <p className="mt-2 text-[0.8125rem] leading-snug text-body">
            of patients the model can memorise and then be tested on
          </p>
        </div>
        <div className="border-t-2 border-rule pt-3">
          <p className="tnum font-serif text-[1.75rem] font-semibold leading-none text-ink">
            {nPatients * slicesEach}
          </p>
          <p className="mt-2 text-[0.8125rem] leading-snug text-body">
            pictures, from {nPatients} people
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["Patients", nPatients, 4, 24, setNPatients, ""],
          ["Pictures each", slicesEach, 2, 14, setSlicesEach, ""],
          ["Held back for testing", Math.round(testFrac * 100), 10, 50,
            (v: number) => setTestFrac(v / 100), "%"],
        ] as const).map(([label, val, min, max, set, unit]) => (
          <label key={label} className="block">
            <span className="mb-1.5 block text-[0.8125rem] text-body">
              {label}: <span className="tnum text-ink">{val}{unit}</span>
            </span>
            <input type="range" min={min} max={max} value={val}
                   onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
                   aria-label={label as string}
                   className="w-full accent-[#1D5B8F]" />
          </label>
        ))}
        <button type="button" onClick={() => setSeed((s) => s + 1)}
                className="self-end border border-rule bg-white px-3 py-2 text-[0.8125rem] hover:border-steel">
          Shuffle again
        </button>
      </div>

      {mode === "slice" ? (
        <Callout tone="warn" title="This is the mistake">
          Almost every column has both colours in it. That means almost every patient has some
          of their pictures in the training pile and the rest in the test pile. Slices from one
          head look nearly identical, so the model can learn a person during training and then
          recognise them again at test time. It never has to learn anything about dementia.
          {lk && (
            <> On the real dataset this took the score from{" "}
              {(lk.honest_subject_split_slice_level.balanced_accuracy * 100).toFixed(1)} percent to{" "}
              {(lk.leaky_random_split.balanced_accuracy * 100).toFixed(1)} percent.</>
          )}
        </Callout>
      ) : (
        <Callout tone="good" title="This is the fix">
          Every column is a single colour. A patient is either entirely in training or entirely
          in testing, so there is nothing to recognise at test time. The score drops, sometimes a
          lot, and what is left is a real measurement. In scikit-learn this is{" "}
          <code className="font-mono text-[0.8125rem]">GroupKFold</code> or{" "}
          <code className="font-mono text-[0.8125rem]">StratifiedGroupKFold</code>, with the
          patient identifier passed as <code className="font-mono text-[0.8125rem]">groups</code>.
        </Callout>
      )}
    </div>
  );
}
