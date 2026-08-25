"use client";

import { useState } from "react";
import { Chart, Toggle } from "../ui";
import { C, DataTable } from "./primitives";
import { SHORT } from "@/lib/types";

export default function ConfusionMatrix({
  slice, subject, defaultLevel = "subject", names = SHORT,
}: {
  slice: number[][]; subject: number[][]; defaultLevel?: "slice" | "subject"; names?: string[];
}) {
  const [level, setLevel] = useState<"slice" | "subject">(defaultLevel);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const cm = level === "subject" ? subject : slice;
  const rowSums = cm.map((r) => r.reduce((a, b) => a + b, 0));
  const unit = level === "subject" ? "patient" : "slice";

  return (
    <Chart
      title="Where the predictions land"
      note={`Rows are the clinical label, columns are what the model said. Shading is the share of each row. Counts are ${unit}s.`}
      tools={
        <Toggle
          label="Choose scoring level"
          value={level}
          onChange={setLevel}
          options={[["subject", "Per patient"], ["slice", "Per slice"]]}
        />
      }
    >
      <div className="min-w-[440px]">
        <table className="w-full border-collapse text-center text-[0.8125rem]">
          <caption className="sr-only">
            Confusion matrix, {level === "subject" ? "one row per patient" : "one row per slice"}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="py-2 pr-3 text-left font-normal text-muted">
                actual \ predicted
              </th>
              {names.map((n) => (
                <th key={n} scope="col" className="px-1 py-2 font-medium text-body">{n}</th>
              ))}
              <th scope="col" className="pl-3 py-2 font-normal text-muted">recall</th>
            </tr>
          </thead>
          <tbody>
            {cm.map((row, i) => (
              <tr key={i}>
                <th scope="row" className="whitespace-nowrap py-1 pr-3 text-left font-medium text-body">
                  {names[i]}
                </th>
                {row.map((v, j) => {
                  const frac = rowSums[i] ? v / rowSums[i] : 0;
                  const on = hover?.[0] === i && hover?.[1] === j;
                  const diag = i === j;
                  const base = diag ? [44, 110, 78] : [160, 48, 39];
                  const alpha = v === 0 ? 0.05 : 0.12 + 0.72 * frac;
                  return (
                    <td key={j} className="p-0.5">
                      <div
                        tabIndex={0}
                        onMouseEnter={() => setHover([i, j])}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover([i, j])}
                        onBlur={() => setHover(null)}
                        title={`${v} ${unit}${v === 1 ? "" : "s"} with label ${names[i]} predicted as ${names[j]}`}
                        className="cursor-default rounded-sm px-2 py-2.5 transition-shadow"
                        style={{
                          background: `rgba(${base.join(",")},${alpha})`,
                          color: frac > 0.55 ? "#fff" : C.ink,
                          boxShadow: on ? `inset 0 0 0 2px ${C.ink}` : "none",
                        }}
                      >
                        <div className="tnum text-[0.9375rem] font-medium leading-none">{v}</div>
                        <div className="tnum mt-1 text-[0.6875rem] opacity-80">
                          {rowSums[i] ? `${Math.round(frac * 100)}%` : "n/a"}
                        </div>
                      </div>
                    </td>
                  );
                })}
                <td className="tnum pl-3 text-muted">
                  {rowSums[i] ? `${Math.round((row[i] / rowSums[i]) * 100)}%` : "n/a"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-[0.8125rem] text-muted">
          {hover
            ? `${cm[hover[0]][hover[1]]} ${unit}${cm[hover[0]][hover[1]] === 1 ? "" : "s"} labelled ${names[hover[0]]} were predicted as ${names[hover[1]]}.`
            : "Hover or tab through a cell to read it out."}
        </p>
      </div>

      <DataTable
        caption="Confusion matrix counts"
        head={["Actual", ...names]}
        rows={cm.map((row, i) => [names[i], ...row])}
      />
    </Chart>
  );
}
