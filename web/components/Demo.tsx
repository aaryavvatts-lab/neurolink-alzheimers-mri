"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { preprocess } from "@/lib/preprocess";
import { camToRGBA, getMeta, loadModel, predict, type Prediction } from "@/lib/model";
import { SHORT } from "@/lib/types";
import { Note } from "./ui";

interface Sample {
  id: string; subject: string; slice: number;
  true_label: number; true_name: string;
  raw: string; pre: string;
  pytorch_probs: number[]; pytorch_pred: number;
}

const TONE = ["#3ddc97", "#f5c542", "#ff9f45", "#ff5c5c"];

function grayToImageData(gray: Float32Array, size: number): ImageData {
  const img = new ImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = gray[i];
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  return img;
}

async function fileToImageData(src: string | File): Promise<ImageData> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("could not decode image"));
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
  const [statusMsg, setStatusMsg] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [active, setActive] = useState<Sample | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [showCam, setShowCam] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [parity, setParity] = useState<{ maxDiff: number; agree: boolean } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastGray = useRef<Float32Array | null>(null);

  useEffect(() => {
    fetch("/samples/index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((s: Sample[]) => setSamples(s))
      .catch(() => setSamples([]));
  }, []);

  const ensureModel = useCallback(async () => {
    if (status === "ready") return true;
    setStatus("loading");
    try {
      await loadModel((m) => setStatusMsg(m));
      setStatus("ready");
      return true;
    } catch (e) {
      setStatus("error");
      setStatusMsg(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [status]);

  const draw = useCallback((gray: Float32Array, p: Prediction | null, overlay: boolean) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const size = Math.sqrt(gray.length) | 0;
    cv.width = size; cv.height = size;
    const ctx = cv.getContext("2d")!;
    ctx.putImageData(
      overlay && p ? camToRGBA(p.cam, p.camH, p.camW, gray, size) : grayToImageData(gray, size),
      0, 0
    );
  }, []);

  const run = useCallback(async (src: string | File, sample: Sample | null) => {
    setBusy(true); setParity(null);
    try {
      if (!(await ensureModel())) return;
      const meta = getMeta();
      const size = meta?.input_size ?? 224;
      const imgData = await fileToImageData(src);

      // Run the SAME pipeline the training code used, in TypeScript.
      const pre = preprocess(imgData, size, 0.04, meta?.mean ?? 0.449, meta?.std ?? 0.226);
      const p = await predict(pre.tensor, size);

      lastGray.current = pre.gray;
      setResult(p);
      setActive(sample);
      draw(pre.gray, p, showCam);

      // Self-check: for gallery samples we know what PyTorch produced on the
      // server for this exact file. If the browser disagrees, the TypeScript
      // preprocessing has drifted from the Python and the demo is not honest.
      if (sample) {
        const maxDiff = Math.max(...p.probs.map((v, i) => Math.abs(v - sample.pytorch_probs[i])));
        setParity({ maxDiff, agree: p.pred === sample.pytorch_pred });
      }
    } catch (e) {
      setStatus("error");
      setStatusMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [draw, ensureModel, showCam]);

  useEffect(() => {
    if (lastGray.current) draw(lastGray.current, result, showCam);
  }, [showCam, result, draw]);

  const onUpload = (f: File | undefined) => {
    if (!f) return;
    setUploadName(f.name);
    run(f, null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      {/* ---------- left: image + controls ---------- */}
      <div className="space-y-3">
        <div className="card overflow-hidden">
          <div className="aspect-square bg-black/50 flex items-center justify-center">
            {result ? (
              <canvas ref={canvasRef} className="h-full w-full object-contain [image-rendering:auto]" />
            ) : (
              <div className="p-8 text-center text-sm text-muted">
                Pick a held-out scan below, or upload one.
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-line bg-panel px-3 py-2 text-xs hover:border-accent/60">
            Upload an MRI slice
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>
          <button
            onClick={() => setShowCam((v) => !v)}
            disabled={!result}
            className="rounded-lg border border-line bg-panel px-3 py-2 text-xs disabled:opacity-40 hover:border-accent/60"
          >
            {showCam ? "Hide attention" : "Show attention"}
          </button>
        </div>

        {uploadName && (
          <p className="text-[11px] text-muted">
            Loaded <span className="mono">{uploadName}</span> — processed locally, never uploaded.
          </p>
        )}
      </div>

      {/* ---------- right: prediction ---------- */}
      <div className="space-y-4">
        {status === "loading" && (
          <Note>Loading model — {statusMsg}…</Note>
        )}
        {status === "error" && (
          <Note tone="warn">
            In-browser inference failed: <span className="mono">{statusMsg}</span>. The precomputed
            predictions in the gallery below still show what the model does.
          </Note>
        )}

        {result && (
          <div className="card p-5 space-y-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Predicted stage</p>
                <p className="text-2xl font-semibold" style={{ color: TONE[result.pred] }}>
                  {SHORT[result.pred]}
                </p>
              </div>
              {active && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-muted">Clinical label</p>
                  <p className="text-sm text-slate-300">{active.true_name}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {result.probs.map((p, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs">
                    <span className={i === result.pred ? "text-white" : "text-muted"}>{SHORT[i]}</span>
                    <span className="tabular-nums text-muted">{(p * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-line/60">
                    <div className="h-2 rounded-full transition-all"
                      style={{ width: `${p * 100}%`, background: TONE[i] }} />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted">
              {result.ms.toFixed(0)} ms in your browser (WASM, single-threaded).
              {" "}Warm colours mark the regions the classifier weighted most.
            </p>

            {parity && (
              <Note tone={parity.agree && parity.maxDiff < 0.02 ? "good" : "warn"}>
                <strong>Pipeline self-check:</strong>{" "}
                {parity.agree
                  ? `browser matches the PyTorch prediction for this file (max probability difference ${parity.maxDiff.toFixed(4)}).`
                  : `browser DISAGREES with PyTorch on this file (max difference ${parity.maxDiff.toFixed(4)}). The TypeScript preprocessing has drifted from the Python.`}
              </Note>
            )}
          </div>
        )}

        {/* ---------- gallery ---------- */}
        <div className="card p-5">
          <p className="mb-1 text-sm font-medium text-white">Held-out scans</p>
          <p className="mb-4 text-xs text-muted">
            Every subject below was excluded from training. Percentages are the model&apos;s
            confidence in its own top choice, computed offline in PyTorch.
          </p>
          {samples.length === 0 ? (
            <p className="text-xs text-muted">No samples exported yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {samples.map((s) => {
                const ok = s.pytorch_pred === s.true_label;
                return (
                  <button
                    key={s.id}
                    onClick={() => run(s.raw, s)}
                    disabled={busy}
                    title={`${s.subject} · slice ${s.slice} · true: ${s.true_name}`}
                    className={`group relative overflow-hidden rounded-lg border transition ${
                      active?.id === s.id ? "border-accent" : "border-line hover:border-accent/60"
                    } disabled:opacity-50`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.pre} alt={s.true_name} className="aspect-square w-full object-cover" />
                    <span
                      className="absolute left-1 top-1 rounded px-1 text-[9px] font-medium"
                      style={{ background: TONE[s.true_label], color: "#0b1020" }}
                    >
                      {SHORT[s.true_label]}
                    </span>
                    <span className={`absolute right-1 top-1 text-[10px] ${ok ? "text-good" : "text-warn"}`}>
                      {ok ? "✓" : "✗"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
