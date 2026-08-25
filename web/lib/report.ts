/**
 * Turning a set of predictions into something a person can read and keep.
 *
 * The demo used to answer with four percentages and stop. That is the least
 * useful thing it can say. A person who drops in a scan wants to know what the
 * answer means, how much to trust it, what the model was looking at, and what
 * the honest caveats are, and they should be able to take that away rather than
 * screenshot it.
 */

import { FULL, SHORT } from "./types";

export interface SlicePrediction {
  name: string;
  probs: number[];
  pred: number;
  ms: number;
}

export interface Aggregate {
  probs: number[];
  pred: number;
  confidence: number;
  /** Share of slices that individually voted for the aggregate answer. */
  agreement: number;
  nSlices: number;
  /** Second most likely stage, and how close it is. */
  runnerUp: number;
  margin: number;
}

export function aggregate(slices: SlicePrediction[]): Aggregate {
  const n = slices.length;
  const probs = [0, 1, 2, 3].map(
    (c) => slices.reduce((s, x) => s + x.probs[c], 0) / n
  );
  const order = [...probs.keys()].sort((a, b) => probs[b] - probs[a]);
  const pred = order[0];
  const runnerUp = order[1];
  return {
    probs,
    pred,
    confidence: probs[pred],
    agreement: slices.filter((s) => s.pred === pred).length / n,
    nSlices: n,
    runnerUp,
    margin: probs[pred] - probs[runnerUp],
  };
}

/** How much weight to put on this answer, in plain words. */
export function readTrust(a: Aggregate): { level: "low" | "medium" | "higher"; text: string } {
  if (a.nSlices === 1) {
    return {
      level: "low",
      text:
        "This is one slice. Every honest number on this site is measured by averaging a " +
        "whole scan, because a single cut through a head is thin evidence and the answer " +
        "moves a lot depending on where the cut was taken. Treat this as a demonstration " +
        "of the mechanism, not as a reading.",
    };
  }
  if (a.margin < 0.15) {
    return {
      level: "low",
      text:
        `The top two answers are ${(a.margin * 100).toFixed(0)} points apart, which is close. ` +
        `The model is not really choosing between ${SHORT[a.pred]} and ${SHORT[a.runnerUp]} ` +
        `here so much as splitting the difference.`,
    };
  }
  if (a.agreement < 0.6) {
    return {
      level: "medium",
      text:
        `Only ${(a.agreement * 100).toFixed(0)} percent of the individual slices agreed with ` +
        `the overall answer. The average points one way but the scan is not consistent, which ` +
        `usually means the signal is coming from a narrow band of slices.`,
    };
  }
  return {
    level: "higher",
    text:
      `${(a.agreement * 100).toFixed(0)} percent of the slices agreed with the overall answer ` +
      `and the top two are ${(a.margin * 100).toFixed(0)} points apart. That is about as ` +
      `settled as this model gets. It is still a model with 0.94 area under the curve on a ` +
      `yes or no question, trained on 242 people.`,
  };
}

/** A short written account of what the model did, for download. */
export function buildReport(
  slices: SlicePrediction[],
  agg: Aggregate,
  meta: { arch: string; inputSize: number }
): string {
  const now = new Date().toISOString().replace("T", " ").slice(0, 16);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const trust = readTrust(agg);

  const lines = [
    "SLICEWISE REPORT",
    "================",
    "",
    "NOT A MEDICAL RESULT. This is a student research demonstration. It has no",
    "regulatory approval, has never been tested in a clinic, and must not be used",
    "to make any decision about any person's health.",
    "",
    `Produced       ${now}`,
    `Model          ${meta.arch}, ${meta.inputSize}px input, trained on OASIS`,
    `Images read    ${slices.length}`,
    "",
    "OVERALL ANSWER",
    "--------------",
    `Stage          ${FULL[agg.pred]}`,
    `Confidence     ${pct(agg.confidence)}`,
    `Runner up      ${FULL[agg.runnerUp]} at ${pct(agg.probs[agg.runnerUp])}`,
    `Slice agreement ${pct(agg.agreement)} of images voted the same way`,
    "",
    "FULL BREAKDOWN",
    "--------------",
    ...FULL.map((f, i) => `${f.padEnd(22)} ${pct(agg.probs[i]).padStart(7)}`),
    "",
    "HOW MUCH TO TRUST IT",
    "--------------------",
    ...wrap(trust.text, 76),
    "",
    "PER IMAGE",
    "---------",
    ...slices.map(
      (s) =>
        `${s.name.slice(0, 34).padEnd(36)} ${SHORT[s.pred].padEnd(11)} ${pct(
          s.probs[s.pred]
        ).padStart(7)}`
    ),
    "",
    "WHAT THIS MODEL IS",
    "------------------",
    ...wrap(
      "A small convolutional network trained on the OASIS cross-sectional MRI " +
        "collection, which holds scans from 347 people. It was split by patient, so " +
        "no one in the test set was seen during training. On held-out patients it " +
        "reaches about 0.94 area under the curve separating any dementia from none, " +
        "and about 0.41 balanced accuracy across the four stages, where guessing " +
        "scores 0.25.",
      76
    ),
    "",
    ...wrap(
      "The same model trained on images with the brain erased still scores 0.38, " +
        "so a meaningful part of its apparent skill comes from head shape rather " +
        "than brain tissue. That is reported openly on the site and is a reason to " +
        "treat any single answer with caution.",
      76
    ),
    "",
    "Full method and results: https://slicewise-mri.vercel.app",
  ];
  return lines.join("\n");
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      out.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}
