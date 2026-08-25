/**
 * Regression test: the TypeScript preprocessing must reproduce the Python.
 *
 * The live demo runs lib/preprocess.ts on a raw JPG in the visitor's browser.
 * The model was trained on images produced by src/neurolink/data/preprocess.py.
 * If those two pipelines drift, the demo feeds the network inputs unlike
 * anything it saw in training and quietly reports nonsense -- with no error.
 *
 * Fixtures are produced by the Python side: raw RGBA pixels plus the exact
 * 160x160 normalised tensor Python derives from them. This test runs the
 * TypeScript pipeline over the same pixels and compares.
 *
 *   npx tsx web/test/preprocess.parity.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { preprocess } from "../lib/preprocess";

// Resolved from the working directory so this runs the same whether tsx loads
// the file as an ES module or compiles it to CommonJS.
const DIR = path.resolve(process.cwd(), "test", "fixtures");
const cases = JSON.parse(readFileSync(path.join(DIR, "cases.json"), "utf8"));

// Python downsamples 224 -> 160 on the GPU with bilinear/align_corners=False.
// The browser reaches 160 directly from the crop, so a small resampling
// difference is expected and harmless; what must not differ is the crop, the
// intensity normalisation, or the orientation.
// Calibrated to what the matched pipeline actually achieves (corr >= 0.99991,
// mean|diff| <= 0.0224), with a little margin. Tight on purpose: these bounds
// exist to catch a future edit that silently changes preprocessing.
const TOL_MEAN = 0.03;
const TOL_CORR = 0.9998;

let failures = 0;

for (const c of cases) {
  const rgba = new Uint8ClampedArray(readFileSync(path.join(DIR, `${c.id}.rgba`)));
  const img = { data: rgba, width: c.width, height: c.height } as ImageData;

  const got = preprocess(img, 160, 0.04, 0.449, 0.226).tensor.subarray(0, 160 * 160);
  const want = Float32Array.from(c.tensor160.slice(0, 160 * 160));

  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, absdiff = 0;
  const n = want.length;
  for (let i = 0; i < n; i++) {
    const a = got[i], b = want[i];
    sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b;
    absdiff += Math.abs(a - b);
  }
  const corr = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  const mad = absdiff / n;
  const ok = corr >= TOL_CORR && mad <= TOL_MEAN;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${c.id.padEnd(24)} corr ${corr.toFixed(5)}  mean|diff| ${mad.toFixed(4)}`
  );
}

console.log(
  failures === 0
    ? `\nAll ${cases.length} fixtures match — the browser reproduces the Python pipeline.`
    : `\n${failures}/${cases.length} FAILED — the browser demo would feed the model out-of-distribution inputs.`
);
process.exit(failures === 0 ? 0 : 1);
