"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { preprocess } from "@/lib/preprocess";
import { camToRGBA, getMeta, loadModel, predict, type Prediction } from "@/lib/model";
import { SHORT, FULL } from "@/lib/types";
import { aggregate, buildReport, readTrust, type Aggregate, type SlicePrediction } from "@/lib/report";
import { STAGE } from "./charts/primitives";
import { Callout } from "./ui";

interface Sample {
  id: string; subject: string; slice: number;
  true_label: number; true_name: string;
  raw: string; pre: string;
  pytorch_probs: number[]; pytorch_pred: number;
}

function grayToImageData(gray: Float32Array, size: number): ImageData {
  const img = new ImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = gray[i];
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  return img;
}

async function toImageData(src: string | File): Promise<ImageData> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("That file could not be read as an image."));
    img.src = url;
  });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  if (typeof src !== "string") URL.revokeObjectURL(url);
  return data;
}

export default function Demo() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [active, setActive] = useState<Sample | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [overlay, setOverlay] = useState(0.6);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [check, setCheck] = useState<{ diff: number; agree: boolean } | null>(null);
  const [batch, setBatch] = useState<SlicePrediction[]>([]);
  const [agg, setAgg] = useState<Aggregate | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grayRef = useRef<Float32Array | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/samples/index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setSamples)
      .catch(() => setSamples([]));
  }, []);

  const draw = useCallback((gray: Float32Array, p: Prediction | null, alpha: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const size = Math.round(Math.sqrt(gray.length));
    cv.width = size; cv.height = size;
    const ctx = cv.getContext("2d")!;
    ctx.putImageData(
      p && alpha > 0.02
        ? camToRGBA(p.cam, p.camH, p.camW, gray, size, alpha)
        : grayToImageData(gray, size),
      0, 0
    );
  }, []);

  const run = useCallback(async (src: string | File, sample: Sample | null, label: string) => {
    setBusy(true); setCheck(null); setSource(label); setBatch([]); setAgg(null);
    try {
      if (status !== "ready") {
        setStatus("loading");
        await loadModel((m) => setMsg(m));
        setStatus("ready");
      }
      const meta = getMeta();
      const size = meta?.input_size ?? 160;
      const imgData = await toImageData(src);
      const pre = preprocess(imgData, size, 0.04, meta?.mean ?? 0.449, meta?.std ?? 0.226);
      const p = await predict(pre.tensor, size);

      grayRef.current = pre.gray;
      setResult(p);
      setActive(sample);
      draw(pre.gray, p, overlay);

      if (sample) {
        const diff = Math.max(...p.probs.map((v, i) => Math.abs(v - sample.pytorch_probs[i])));
        setCheck({ diff, agree: p.pred === sample.pytorch_pred });
      }
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [draw, overlay, status]);

  useEffect(() => {
    if (grayRef.current) draw(grayRef.current, result, overlay);
  }, [overlay, result, draw]);

  /**
   * Reads however many images were given.
   *
   * One image gets the single-slice path. Several are treated as slices of one
   * scan and averaged into a single answer, which is how every number reported
   * on this site is measured. A model that answers per picture and a model that
   * answers per person are not the same tool, and the second one is the useful
   * one.
   */
  const onFiles = useCallback(async (files: FileList | null) => {
    const imgs = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) {
      setStatus("error");
      setMsg("No images there. The scans in this dataset are JPGs, and you can drop in several at once.");
      return;
    }
    imgs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (imgs.length === 1) {
      setBatch([]); setAgg(null);
      run(imgs[0], null, imgs[0].name);
      return;
    }

    setBusy(true); setCheck(null); setActive(null); setSource(`${imgs.length} images`);
    try {
      if (status !== "ready") {
        setStatus("loading");
        await loadModel((m) => setMsg(m));
        setStatus("ready");
      }
      const meta = getMeta();
      const size = meta?.input_size ?? 160;
      const out: SlicePrediction[] = [];
      let lastGray: Float32Array | null = null;
      let lastPred: Prediction | null = null;

      for (let i = 0; i < imgs.length; i++) {
        setProgress(`Reading image ${i + 1} of ${imgs.length}`);
        const data = await toImageData(imgs[i]);
        const pre = preprocess(data, size, 0.04, meta?.mean ?? 0.449, meta?.std ?? 0.226);
        const p = await predict(pre.tensor, size);
        out.push({ name: imgs[i].name, probs: p.probs, pred: p.pred, ms: p.ms });
        lastGray = pre.gray; lastPred = p;
        // let the browser paint the progress line
        await new Promise((r) => setTimeout(r, 0));
      }

      const a = aggregate(out);
      setBatch(out); setAgg(a);
      if (lastGray && lastPred) {
        grayRef.current = lastGray;
        setResult(lastPred);
        draw(lastGray, lastPred, overlay);
      }
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false); setProgress(null);
    }
  }, [draw, overlay, run, status]);

  const downloadReport = useCallback(() => {
    const meta = getMeta();
    const slices: SlicePrediction[] = batch.length
      ? batch
      : result
        ? [{ name: source ?? "image", probs: result.probs, pred: result.pred, ms: result.ms }]
        : [];
    if (!slices.length) return;
    const a = agg ?? aggregate(slices);
    const text = buildReport(slices, a, {
      arch: meta?.arch ?? "resnet", inputSize: meta?.input_size ?? 160,
    });
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "slicewise-report.txt";
    link.click();
    URL.revokeObjectURL(url);
  }, [batch, agg, result, source]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* ---------------- left: input and picture ---------------- */}
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
          className={`fig relative aspect-square overflow-hidden transition-colors ${
            dragging ? "border-steel bg-steel/5" : ""
          }`}
        >
          {agg && (
          <div className="fig p-5">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
              <div>
                <p className="p-small">
                  Averaged over {agg.nSlices} images, the way a whole scan is scored
                </p>
                <p className="font-serif text-[1.75rem] font-semibold leading-tight"
                   style={{ color: STAGE[agg.pred] }}>
                  {FULL[agg.pred]}
                </p>
              </div>
              <button type="button" onClick={downloadReport}
                      className="border border-ink px-3 py-2 text-[0.8125rem] hover:bg-ink hover:text-white">
                Download the full report
              </button>
            </div>

            <ul className="mt-4 space-y-2.5">
              {agg.probs.map((p, i) => (
                <li key={i}>
                  <div className="flex justify-between text-[0.8125rem]">
                    <span className={i === agg.pred ? "text-ink" : "text-muted"}>{SHORT[i]}</span>
                    <span className="tnum text-muted">{(p * 100).toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full bg-rule/70">
                    <div className="h-1.5" style={{ width: `${Math.max(p * 100, 0.6)}%`, background: STAGE[i] }} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="border-t border-rule pt-2">
                <p className="tnum font-serif text-[1.25rem] text-ink">
                  {(agg.agreement * 100).toFixed(0)}%
                </p>
                <p className="p-small">of images voted this way on their own</p>
              </div>
              <div className="border-t border-rule pt-2">
                <p className="tnum font-serif text-[1.25rem] text-ink">
                  {(agg.margin * 100).toFixed(0)} pts
                </p>
                <p className="p-small">ahead of {SHORT[agg.runnerUp]}, the next best answer</p>
              </div>
              <div className="border-t border-rule pt-2">
                <p className="tnum font-serif text-[1.25rem] text-ink">{agg.nSlices}</p>
                <p className="p-small">images read, in {(batch.reduce((s, x) => s + x.ms, 0) / 1000).toFixed(1)}s</p>
              </div>
            </div>

            <div className="mt-5">
              <Callout tone={readTrust(agg).level === "higher" ? "good" : "warn"}
                       title="How much to trust this">
                {readTrust(agg).text}
              </Callout>
            </div>

            <details className="mt-5">
              <summary className="cursor-pointer text-[0.875rem] text-steel">
                Show what each image said on its own
              </summary>
              <div className="scroll-x mt-3">
                <table className="data min-w-[380px]">
                  <thead>
                    <tr><th>Image</th><th>Answer</th><th className="text-right">Confidence</th></tr>
                  </thead>
                  <tbody>
                    {batch.map((b) => (
                      <tr key={b.name}>
                        <td className="pr-4 font-mono text-[0.75rem]">{b.name.slice(0, 40)}</td>
                        <td style={{ color: STAGE[b.pred] }}>{SHORT[b.pred]}</td>
                        <td className="text-right">{(b.probs[b.pred] * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}

        {result ? (
            <canvas
              ref={canvasRef}
              className="h-full w-full object-contain"
              aria-label="The scan after processing, with the model's attention drawn over it"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <canvas ref={canvasRef} className="hidden" />
              <p className="text-[0.9375rem] text-body">
                Drop a brain scan here, or several at once.
              </p>
              <p className="text-[0.8125rem] text-muted">
                Drop a whole folder of slices from one scan and they are averaged into a
                single answer, which is how every number on this site is measured.
              </p>
              <p className="text-[0.8125rem] text-muted">
                Read on your own machine. Nothing is uploaded.
              </p>
            </div>
          )}

          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <p className="text-[0.875rem] text-body">
                {progress ?? (status === "loading" ? `Getting the model ready (${msg})` : "Working")}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded border border-rule bg-white px-3 py-2 text-[0.875rem] hover:border-steel"
          >
            Choose files
          </button>
          <input
            ref={fileRef} type="file" accept="image/*" className="sr-only"
            multiple
            onChange={(e) => onFiles(e.target.files)}
          />
          {result && (
            <label className="flex flex-1 items-center gap-3 rounded border border-rule bg-white px-3 py-2">
              <span className="whitespace-nowrap text-[0.8125rem] text-muted">Attention</span>
              <input
                type="range" min={0} max={1} step={0.05} value={overlay}
                onChange={(e) => setOverlay(Number(e.target.value))}
                aria-label="How strongly to draw the attention map over the scan"
                className="w-full accent-[#1D5B8F]"
              />
            </label>
          )}
        </div>

        {source && (
          <p className="p-small">
            Showing <span className="font-mono text-[0.8125rem]">{source}</span>
          </p>
        )}
      </div>

      {/* ---------------- right: what the model said ---------------- */}
      <div className="space-y-5">
        {status === "error" && (
          <Callout tone="warn" title="That did not work">
            {msg}. The examples below still show what the model does, because those
            answers were worked out ahead of time.
          </Callout>
        )}

        {result ? (
          <div className="fig p-5">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
              <div>
                <p className="p-small">The model says</p>
                <p className="font-serif text-[1.75rem] font-semibold leading-tight"
                   style={{ color: STAGE[result.pred] }}>
                  {FULL[result.pred]}
                </p>
              </div>
              {active && (
                <div className="text-right">
                  <p className="p-small">Clinician&apos;s label</p>
                  <p className="text-[0.9375rem] text-body">{FULL[active.true_label]}</p>
                </div>
              )}
            </div>

            <ul className="mt-4 space-y-2.5">
              {result.probs.map((p, i) => (
                <li key={i}>
                  <div className="flex justify-between text-[0.8125rem]">
                    <span className={i === result.pred ? "text-ink" : "text-muted"}>{SHORT[i]}</span>
                    <span className="tnum text-muted">{(p * 100).toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full bg-rule/70">
                    <div className="h-1.5 transition-all"
                         style={{ width: `${Math.max(p * 100, 0.6)}%`, background: STAGE[i] }} />
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-4 p-small">
              Worked out in {result.ms.toFixed(0)} milliseconds on your machine. Warm colours on
              the picture show the parts of the slice that pushed hardest towards the answer above.
            </p>

            {!agg && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={downloadReport}
                        className="border border-rule px-3 py-2 text-[0.8125rem] hover:border-steel">
                  Download the full report
                </button>
                <span className="p-small">
                  One slice only. Drop in several from the same scan for a steadier answer.
                </span>
              </div>
            )}

            {check && (
              <div className="mt-4">
                <Callout tone={check.agree && check.diff < 0.02 ? "good" : "warn"}>
                  {check.agree
                    ? `Cross-check passed. Running this file in the browser gives the same answer as running it in Python, to within ${check.diff.toFixed(4)}.`
                    : `Cross-check failed. The browser and Python disagree on this file by ${check.diff.toFixed(4)}, which means the two versions of the image handling have drifted apart.`}
                </Callout>
              </div>
            )}
          </div>
        ) : (
          <div className="fig p-5">
            <p className="p-body">
              Pick one of the scans below. Each one belongs to a patient the model never
              saw while it was learning, so these are honest tests rather than recall.
            </p>
            <p className="mt-3 p-small">
              The model file is about 45 MB and is fetched the first time you run it.
            </p>
          </div>
        )}

        {/* gallery */}
        <div className="fig p-5">
          <p className="text-[0.9375rem] font-medium text-ink">Scans the model has never seen</p>
          <p className="mt-1 p-small">
            One tile per patient, not per picture. A tick means the model agreed with the
            clinician, a cross means it did not. The moderate group has a single tile because
            the held-out set contains a single moderate patient, which is the honest size of
            that group rather than a display choice.
          </p>
          {samples.length === 0 ? (
            <p className="mt-4 p-small">No examples have been exported yet.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {samples.map((s) => {
                const ok = s.pytorch_pred === s.true_label;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => run(s.raw, s, `${s.subject}, slice ${s.slice}`)}
                      disabled={busy}
                      className={`group relative block w-full overflow-hidden border transition ${
                        active?.id === s.id ? "border-ink" : "border-rule hover:border-steel"
                      } disabled:opacity-50`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.pre} alt={`Scan from patient ${s.subject}, labelled ${s.true_name}`}
                           className="aspect-square w-full object-cover" />
                      <span className="absolute left-0 top-0 px-1 py-0.5 text-[0.625rem] font-medium text-white"
                            style={{ background: STAGE[s.true_label] }}>
                        {SHORT[s.true_label]}
                      </span>
                      <span className="absolute right-0.5 top-0.5 text-[0.75rem] font-bold"
                            style={{ color: ok ? "#2C6E4E" : "#A03027" }} aria-hidden="true">
                        {ok ? "✓" : "✗"}
                      </span>
                      <span className="sr-only">{ok ? "model agreed" : "model disagreed"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
