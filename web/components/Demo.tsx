"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { preprocess } from "@/lib/preprocess";
import { camToRGBA, getMeta, loadModel, predict, type Prediction } from "@/lib/model";
import { SHORT, FULL } from "@/lib/types";
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
    setBusy(true); setCheck(null); setSource(label);
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

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setStatus("error");
      setMsg("Please choose an image file. The scans in this dataset are JPGs.");
      return;
    }
    run(f, null, f.name);
  };

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
                Drop a brain scan here, or pick one below.
              </p>
              <p className="text-[0.8125rem] text-muted">
                It is read on your own machine. Nothing is uploaded.
              </p>
            </div>
          )}

          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <p className="text-[0.875rem] text-body">
                {status === "loading" ? `Getting the model ready (${msg})` : "Working"}
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
            Choose a file
          </button>
          <input
            ref={fileRef} type="file" accept="image/*" className="sr-only"
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
            A tick means the model agreed with the clinician on that scan. A cross means it did not.
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
