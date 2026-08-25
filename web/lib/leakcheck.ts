/**
 * Finding grouped leakage in somebody else's file list.
 *
 * The mistake this project ran into is not specific to brain scans. It happens
 * whenever many files come from the same underlying thing: several slices from
 * one patient, several frames from one video, several recordings from one
 * speaker, several photos of one item. Split the files instead of the things
 * and the model can score well by recognising the thing.
 *
 * Everything here runs on the filenames alone, in the browser. No file contents
 * are read and nothing is uploaded.
 */

export interface Candidate {
  id: string;
  label: string;
  /** Pull the group identifier out of one filename, or null if it does not apply. */
  extract: (name: string) => string | null;
}

const base = (p: string) => p.split(/[\\/]/).pop() ?? p;
const noExt = (p: string) => base(p).replace(/\.[A-Za-z0-9]{1,5}$/, "");

export const CANDIDATES: Candidate[] = [
  {
    id: "oasis",
    label: "OASIS style, for example OAS1_0028",
    extract: (n) => n.match(/OAS\d+_\d+/i)?.[0] ?? null,
  },
  {
    id: "bids",
    label: "BIDS style, for example sub-01",
    extract: (n) => n.match(/sub-[A-Za-z0-9]+/i)?.[0] ?? null,
  },
  {
    id: "folder",
    label: "The folder the file sits in",
    extract: (n) => {
      const parts = n.split(/[\\/]/);
      return parts.length > 1 ? parts[parts.length - 2] : null;
    },
  },
  {
    id: "first_us",
    label: "Everything before the first underscore",
    extract: (n) => { const s = noExt(n).split("_"); return s.length > 1 ? s[0] : null; },
  },
  {
    id: "first_two_us",
    label: "The first two underscore parts",
    extract: (n) => { const s = noExt(n).split("_"); return s.length > 2 ? `${s[0]}_${s[1]}` : null; },
  },
  {
    id: "first_dash",
    label: "Everything before the first dash",
    extract: (n) => { const s = noExt(n).split("-"); return s.length > 1 ? s[0] : null; },
  },
  {
    id: "strip_trailing",
    label: "The name with any trailing number removed",
    extract: (n) => {
      const s = noExt(n).replace(/[_-]?\d+$/, "");
      return s && s !== noExt(n) ? s : null;
    },
  },
  {
    id: "patient_word",
    label: "A word like patient, subject or case followed by digits",
    extract: (n) => n.match(/(?:patient|subject|case|participant|id)[_-]?\d+/i)?.[0] ?? null,
  },
];

export interface PatternReport {
  candidate: Candidate;
  groups: number;
  matched: number;
  filesPerGroup: number;
  largestGroup: number;
  /** Higher means this looks more like a real grouping key. */
  score: number;
}

export function scorePattern(files: string[], c: Candidate): PatternReport {
  const counts = new Map<string, number>();
  let matched = 0;
  for (const f of files) {
    const g = c.extract(f);
    if (g === null || g === "") continue;
    matched++;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const groups = counts.size;
  const filesPerGroup = groups ? matched / groups : 0;
  const largestGroup = groups ? Math.max(...counts.values()) : 0;

  // A useful key matches nearly every file, and puts several files in each
  // group. A key that gives one group per file is just the filename again, and
  // a key that puts everything in one group is useless too.
  const coverage = files.length ? matched / files.length : 0;
  const spread = groups > 1 && groups < matched ? Math.min(filesPerGroup / 8, 1) : 0;
  const score = coverage * spread;

  return { candidate: c, groups, matched, filesPerGroup, largestGroup, score };
}

export function rankPatterns(files: string[]): PatternReport[] {
  return CANDIDATES.map((c) => scorePattern(files, c))
    .filter((r) => r.groups > 1)
    .sort((a, b) => b.score - a.score);
}

export interface SplitCheck {
  totalFiles: number;
  totalGroups: number;
  trainFiles: number;
  testFiles: number;
  sharedGroups: string[];
  filesInSharedGroups: number;
  /** How many groups would be split across the boundary by a random file split. */
  expectedSharedIfRandom: number;
}

/** Check a split the user pasted in themselves. */
export function checkExplicitSplit(
  train: string[], test: string[], extract: (n: string) => string | null
): SplitCheck {
  const g = (arr: string[]) => {
    const s = new Set<string>();
    for (const f of arr) { const k = extract(f); if (k) s.add(k); }
    return s;
  };
  const tr = g(train), te = g(test);
  const shared = [...tr].filter((k) => te.has(k));
  const sharedSet = new Set(shared);
  const inShared = [...train, ...test].filter((f) => {
    const k = extract(f);
    return k !== null && sharedSet.has(k);
  }).length;

  const all = new Set([...tr, ...te]);
  return {
    totalFiles: train.length + test.length,
    totalGroups: all.size,
    trainFiles: train.length,
    testFiles: test.length,
    sharedGroups: shared,
    filesInSharedGroups: inShared,
    expectedSharedIfRandom: all.size,
  };
}

/**
 * How bad a plain random split of these files would be.
 *
 * For each group of size n, the chance it lands entirely on one side of an
 * 80/20 split is 0.8^n + 0.2^n. Anything else means it straddles the boundary.
 */
export function simulateRandomSplit(files: string[], extract: (n: string) => string | null,
                                    testFrac = 0.2) {
  const counts = new Map<string, number>();
  for (const f of files) {
    const k = extract(f);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let expectedSplit = 0;
  for (const n of counts.values()) {
    const pure = Math.pow(1 - testFrac, n) + Math.pow(testFrac, n);
    expectedSplit += 1 - pure;
  }
  return {
    groups: counts.size,
    expectedSplitGroups: expectedSplit,
    fraction: counts.size ? expectedSplit / counts.size : 0,
    medianGroupSize: median([...counts.values()]),
  };
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function parseList(text: string): string[] {
  return text
    .split(/[\r\n,]+/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => s.length > 0 && !/^#/.test(s));
}
