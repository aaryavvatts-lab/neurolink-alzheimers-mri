"use client";

import { useMemo, useRef, useState } from "react";
import {
  CANDIDATES, checkExplicitSplit, parseList, rankPatterns, simulateRandomSplit,
} from "@/lib/leakcheck";
import { Callout, Toggle } from "./ui";
import { C } from "./charts/primitives";

const EXAMPLE = `OAS1_0028_MR1_mpr-1_100.jpg
OAS1_0028_MR1_mpr-1_101.jpg
OAS1_0028_MR1_mpr-2_100.jpg
OAS1_0031_MR1_mpr-1_100.jpg
OAS1_0031_MR1_mpr-1_101.jpg
OAS1_0035_MR1_mpr-1_100.jpg
OAS1_0035_MR1_mpr-3_140.jpg
OAS1_0052_MR1_mpr-4_109.jpg`;

export default function LeakChecker() {
  const [mode, setMode] = useState<"all" | "split">("all");
  const [text, setText] = useState("");
  const [trainText, setTrainText] = useState("");
  const [testText, setTestText] = useState("");
  const [patternId, setPatternId] = useState<string | "auto">("auto");
  const fileRef = useRef<HTMLInputElement>(null);

  const files = useMemo(() => parseList(text), [text]);
  const trainFiles = useMemo(() => parseList(trainText), [trainText]);
  const testFiles = useMemo(() => parseList(testText), [testText]);
  const universe = mode === "all" ? files : [...trainFiles, ...testFiles];

  const ranked = useMemo(() => rankPatterns(universe), [universe]);
  const chosen = useMemo(() => {
    if (patternId === "auto") return ranked[0]?.candidate ?? null;
    return CANDIDATES.find((c) => c.id === patternId) ?? null;
  }, [patternId, ranked]);

  const sim = useMemo(
    () => (chosen && universe.length ? simulateRandomSplit(universe, chosen.extract) : null),
    [universe, chosen]
  );
  const split = useMemo(
    () => (chosen && mode === "split" && trainFiles.length && testFiles.length
      ? checkExplicitSplit(trainFiles, testFiles, chosen.extract)
      : null),
    [mode, trainFiles, testFiles, chosen]
  );

  const onFile = (f: File | undefined, setter: (s: string) => void) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setter(String(rd.result ?? ""));
    rd.readAsText(f);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Toggle
          label="What do you want to check"
          value={mode}
          onChange={setMode}
          options={[["all", "I have one list of files"], ["split", "I already have a split"]]}
        />
        <button type="button" onClick={() => { setText(EXAMPLE); setMode("all"); }}
                className="text-[0.8125rem] text-steel underline underline-offset-2">
          Load an example
        </button>
      </div>

      {mode === "all" ? (
        <div>
          <label htmlFor="filelist" className="mb-2 block text-[0.9375rem] text-ink">
            Paste your file names, one per line
          </label>
          <textarea
            id="filelist" value={text} onChange={(e) => setText(e.target.value)}
            rows={9} spellCheck={false}
            placeholder={"patient_012_slice_04.png\npatient_012_slice_05.png\npatient_013_slice_04.png"}
            className="w-full border border-rule bg-white p-3 font-mono text-[0.8125rem] leading-relaxed"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()}
                    className="border border-rule bg-white px-3 py-1.5 text-[0.8125rem] hover:border-steel">
              Load a text or CSV file
            </button>
            <input ref={fileRef} type="file" accept=".txt,.csv,.tsv,text/*" className="sr-only"
                   onChange={(e) => onFile(e.target.files?.[0], setText)} />
            <span className="p-small">{files.length.toLocaleString()} lines read</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {([["Training files", trainText, setTrainText],
             ["Test files", testText, setTestText]] as const).map(([label, val, set]) => (
            <div key={label}>
              <label className="mb-2 block text-[0.9375rem] text-ink">{label}</label>
              <textarea
                value={val} onChange={(e) => set(e.target.value)} rows={9} spellCheck={false}
                className="w-full border border-rule bg-white p-3 font-mono text-[0.8125rem] leading-relaxed"
              />
              <p className="mt-1 p-small">{parseList(val).length.toLocaleString()} lines</p>
            </div>
          ))}
        </div>
      )}

      {universe.length > 0 && (
        <>
          {/* which key */}
          <div className="fig p-5">
            <p className="text-[0.9375rem] font-medium text-ink">
              What ties several files to the same thing?
            </p>
            <p className="mt-1 p-small">
              This is the part people get wrong. It is not the file, it is whatever the file
              came from. Below is what I could find in your names.
            </p>

            {ranked.length === 0 ? (
              <Callout tone="warn">
                I could not find a shared identifier in these names. That might mean every file
                really is independent, in which case a plain random split is fine. It might also
                mean your identifier is stored somewhere other than the filename, in which case
                you will need to group on that column instead.
              </Callout>
            ) : (
              <div className="mt-4 scroll-x">
                <table className="data min-w-[520px]">
                  <thead>
                    <tr>
                      <th>Use</th><th>Rule</th><th>Groups found</th>
                      <th>Files per group</th><th>Biggest group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.slice(0, 5).map((r, i) => {
                      const on = chosen?.id === r.candidate.id;
                      return (
                        <tr key={r.candidate.id}>
                          <td>
                            <input
                              type="radio" name="pattern" checked={on}
                              onChange={() => setPatternId(r.candidate.id)}
                              aria-label={`Group by ${r.candidate.label}`}
                            />
                          </td>
                          <td className="pr-4">
                            {r.candidate.label}
                            {i === 0 && patternId === "auto" && (
                              <span className="ml-2 text-[0.75rem] text-steel">best guess</span>
                            )}
                          </td>
                          <td>{r.groups.toLocaleString()}</td>
                          <td>{r.filesPerGroup.toFixed(1)}</td>
                          <td>{r.largestGroup.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* verdict */}
          {chosen && sim && (
            <div className="fig p-5">
              <p className="text-[0.9375rem] font-medium text-ink">What this means for your split</p>

              {split ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Metric value={split.sharedGroups.length.toLocaleString()}
                            label="groups sitting in both your train and test sets"
                            bad={split.sharedGroups.length > 0} />
                    <Metric value={split.totalGroups.toLocaleString()} label="groups in total" />
                    <Metric value={split.filesInSharedGroups.toLocaleString()}
                            label="files belonging to a group that straddles the line"
                            bad={split.filesInSharedGroups > 0} />
                  </div>

                  {split.sharedGroups.length === 0 ? (
                    <Callout tone="good" title="This split looks clean">
                      No group appears on both sides. Whatever your model scores on this test
                      set is a score on things it has genuinely not seen.
                    </Callout>
                  ) : (
                    <Callout tone="warn" title="This split leaks">
                      {split.sharedGroups.length} of your {split.totalGroups} groups appear in
                      both piles. Your test score is measuring memory as well as skill, and the
                      published work on this suggests the gap can be tens of points. Group your
                      split on the identifier instead of on the file.
                      <details className="mt-3">
                        <summary className="cursor-pointer text-[0.8125rem] text-steel">
                          Show the first offending groups
                        </summary>
                        <p className="mt-2 break-words font-mono text-[0.75rem] text-body">
                          {split.sharedGroups.slice(0, 40).join(", ")}
                          {split.sharedGroups.length > 40 && ` and ${split.sharedGroups.length - 40} more`}
                        </p>
                      </details>
                    </Callout>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Metric value={sim.groups.toLocaleString()} label="separate things your files came from" />
                    <Metric value={sim.medianGroupSize.toFixed(0)} label="files per thing, typical" />
                    <Metric
                      value={`${Math.round(sim.fraction * 100)}%`}
                      label="of them would land in both piles under a random 80/20 file split"
                      bad={sim.fraction > 0.05}
                    />
                  </div>

                  {sim.fraction > 0.05 ? (
                    <Callout tone="warn" title="A random split of these files would leak">
                      About {Math.round(sim.expectedSplitGroups)} of your {sim.groups} groups
                      would end up with some files in training and some in testing. Split on the
                      identifier instead. In scikit-learn that is{" "}
                      <code className="font-mono text-[0.8125rem]">GroupKFold</code> or{" "}
                      <code className="font-mono text-[0.8125rem]">StratifiedGroupKFold</code>,
                      passing the identifier as <code className="font-mono text-[0.8125rem]">groups</code>.
                    </Callout>
                  ) : (
                    <Callout tone="good" title="A random split would probably be fine">
                      Most of your groups hold one file, so splitting files and splitting groups
                      come to nearly the same thing. It still costs nothing to group explicitly.
                    </Callout>
                  )}
                </div>
              )}

              <details className="mt-5">
                <summary className="cursor-pointer text-[0.875rem] text-steel">
                  Show me the code that fixes this
                </summary>
                <pre className="scroll-x mt-3 border border-rule bg-white p-4 font-mono text-[0.8125rem] leading-relaxed text-body">
{`from sklearn.model_selection import StratifiedGroupKFold

# groups holds one identifier per row, repeated for every file
# that came from the same patient, video, speaker or item.
cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=0)
for train_idx, test_idx in cv.split(X, y, groups=groups):
    ...

# and check it, every time, instead of trusting it
overlap = set(groups[train_idx]) & set(groups[test_idx])
assert not overlap, f"{len(overlap)} groups are in both piles"`}
                </pre>
              </details>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ value, label, bad }: { value: string; label: string; bad?: boolean }) {
  return (
    <div className="border-t-2 pt-3" style={{ borderColor: bad ? C.brick : C.rule }}>
      <p className="tnum font-serif text-[1.75rem] font-semibold leading-none"
         style={{ color: bad ? C.brick : C.ink }}>{value}</p>
      <p className="mt-2 text-[0.8125rem] leading-snug text-body">{label}</p>
    </div>
  );
}
