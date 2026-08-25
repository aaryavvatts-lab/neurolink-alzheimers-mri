"use client";

import { useMemo, useState } from "react";
import { SHORT, FULL } from "@/lib/types";
import { STAGE, C } from "./charts/primitives";
import { Toggle } from "./ui";
import type { Results } from "@/lib/types";

type Sort = "subject" | "stage" | "confidence" | "wrong";

export default function PatientBrowser({ r }: { r: Results }) {
  const run = r.primary_run ? r.runs[r.primary_run] : undefined;
  const rows = run?.subject_predictions ?? [];
  const [sort, setSort] = useState<Sort>("stage");
  const [only, setOnly] = useState<"all" | "wrong" | "right">("all");
  const [open, setOpen] = useState<string | null>(null);

  const sorted = useMemo(() => {
    let list = [...rows];
    if (only === "wrong") list = list.filter((p) => p.pred !== p.true);
    if (only === "right") list = list.filter((p) => p.pred === p.true);
    list.sort((a, b) => {
      if (sort === "subject") return a.subject.localeCompare(b.subject);
      if (sort === "stage") return a.true - b.true || a.subject.localeCompare(b.subject);
      if (sort === "confidence") return Math.max(...b.probs) - Math.max(...a.probs);
      return Number(b.pred !== b.true) - Number(a.pred !== a.true);
    });
    return list;
  }, [rows, sort, only]);

  if (!rows.length) return <p className="p-small">No per-patient results have been exported yet.</p>;

  const nWrong = rows.filter((p) => p.pred !== p.true).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          [`${rows.length}`, "patients held out of training"],
          [`${rows.length - nWrong}`, "the model got right"],
          [`${nWrong}`, "it got wrong"],
          [`${Math.round(((rows.length - nWrong) / rows.length) * 100)}%`, "plain accuracy per patient"],
        ].map(([v, l], i) => (
          <div key={l} className="border-t-2 pt-3"
               style={{ borderColor: i === 2 ? C.brick : C.rule }}>
            <p className="tnum font-serif text-[1.5rem] font-semibold leading-none"
               style={{ color: i === 2 ? C.brick : C.ink }}>{v}</p>
            <p className="mt-1.5 text-[0.8125rem] leading-snug text-body">{l}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Toggle label="Show" value={only} onChange={setOnly}
                options={[["all", "All"], ["wrong", "Only mistakes"], ["right", "Only correct"]]} />
        <Toggle label="Sort by" value={sort} onChange={setSort}
                options={[["stage", "Stage"], ["subject", "ID"], ["confidence", "Confidence"]]} />
        <span className="p-small">{sorted.length} shown</span>
      </div>

      <div className="fig scroll-x">
        <table className="w-full min-w-[620px] text-[0.8125rem]">
          <caption className="sr-only">
            Every held-out patient, the clinician label, and what the model predicted
          </caption>
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted">Patient</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted">Clinician said</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted">Model said</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted">How the model split its answer</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted">Sure</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const ok = p.pred === p.true;
              const conf = Math.max(...p.probs);
              const isOpen = open === p.subject;
              return (
                <tr
                  key={p.subject}
                  onClick={() => setOpen(isOpen ? null : p.subject)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : p.subject); } }}
                  className={`cursor-pointer border-b border-rule/50 transition-colors hover:bg-paper ${isOpen ? "bg-paper" : ""}`}
                >
                  <td className="px-4 py-2.5 font-mono text-[0.75rem] text-body">{p.subject}</td>
                  <td className="px-4 py-2.5">
                    <span style={{ color: STAGE[p.true] }}>{SHORT[p.true]}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span style={{ color: STAGE[p.pred] }}>{SHORT[p.pred]}</span>
                    <span className="ml-2 text-[0.75rem]" style={{ color: ok ? C.forest : C.brick }}>
                      {ok ? "correct" : "wrong"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex h-3 w-full min-w-[140px] overflow-hidden rounded-sm">
                      {p.probs.map((v, i) => (
                        <div key={i} style={{ width: `${v * 100}%`, background: STAGE[i] }}
                             title={`${SHORT[i]}: ${(v * 100).toFixed(1)}%`} />
                      ))}
                    </div>
                    {isOpen && (
                      <ul className="mt-2 space-y-0.5">
                        {p.probs.map((v, i) => (
                          <li key={i} className="flex justify-between text-[0.75rem] text-muted">
                            <span>{FULL[i]}</span>
                            <span className="tnum">{(v * 100).toFixed(1)}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tnum text-muted">
                    {(conf * 100).toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="p-small">
        Click any row to see the full split of the answer. The coloured bar shows how the model
        divided its confidence between the four stages, greenest on the left for no dementia
        through to red for moderate.
      </p>
    </div>
  );
}
