/**
 * In-browser inference with onnxruntime-web.
 *
 * The exported graph returns logits AND all four class activation maps, so the
 * attention overlay needs no gradients -- which is what makes it possible at all
 * in WASM. Single-threaded execution is deliberate: multi-threaded ORT needs
 * SharedArrayBuffer, which needs COOP/COEP headers, which a plain static export
 * cannot set. One 224x224 ResNet18 forward pass takes a few hundred milliseconds
 * single-threaded, which is fine for a demo.
 */

import * as ort from "onnxruntime-web";

export interface ModelMeta {
  arch: string;
  input_size: number;
  mean: number;
  std: number;
  classes: string[];
  cdr: number[];
  model_file: string;
}

let session: ort.InferenceSession | null = null;
let meta: ModelMeta | null = null;
let loading: Promise<void> | null = null;

export function getMeta(): ModelMeta | null {
  return meta;
}

export async function loadModel(onProgress?: (s: string) => void): Promise<void> {
  if (session) return;
  if (loading) return loading;

  loading = (async () => {
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
    ort.env.logLevel = "error";

    onProgress?.("fetching model metadata");
    meta = (await (await fetch("/model/model_meta.json")).json()) as ModelMeta;

    onProgress?.("downloading model weights");
    const buf = await (await fetch(`/model/${meta.model_file}`)).arrayBuffer();

    onProgress?.("initialising runtime");
    session = await ort.InferenceSession.create(buf, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    onProgress?.("ready");
  })();

  try {
    await loading;
  } finally {
    loading = null;
  }
}

export interface Prediction {
  probs: number[];
  pred: number;
  cam: Float32Array; // camH * camW, min-max scaled to [0,1]
  camH: number;
  camW: number;
  ms: number;
}

function softmax(v: Float32Array | number[]): number[] {
  const m = Math.max(...Array.from(v));
  const e = Array.from(v, (x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

export async function predict(tensor: Float32Array, size: number): Promise<Prediction> {
  if (!session) throw new Error("model not loaded");
  const t0 = performance.now();

  const input = new ort.Tensor("float32", tensor, [1, 3, size, size]);
  const out = await session.run({ input });

  const logits = out.logits.data as Float32Array;
  const probs = softmax(logits);
  const pred = probs.indexOf(Math.max(...probs));

  // cams: [1, nClasses, h, w] -- take the predicted class's map.
  const camsT = out.cams;
  const [, nCls, camH, camW] = camsT.dims as number[];
  const all = camsT.data as Float32Array;
  const plane = all.subarray(pred * camH * camW, (pred + 1) * camH * camW);

  let lo = Infinity;
  let hi = -Infinity;
  for (const v of plane) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const cam = new Float32Array(camH * camW);
  const range = Math.max(hi - lo, 1e-8);
  for (let i = 0; i < cam.length; i++) cam[i] = (plane[i] - lo) / range;

  void nCls;
  return { probs, pred, cam, camH, camW, ms: performance.now() - t0 };
}

/** Bilinear upsample of the CAM to the display canvas, as an RGBA heat overlay. */
export function camToRGBA(
  cam: Float32Array, camH: number, camW: number,
  gray: Float32Array, size: number, alpha = 0.55
): ImageData {
  const img = new ImageData(size, size);
  for (let y = 0; y < size; y++) {
    const fy = ((y + 0.5) * camH) / size - 0.5;
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(camH - 1, y0 + 1);
    const wy = Math.min(1, Math.max(0, fy - y0));
    for (let x = 0; x < size; x++) {
      const fx = ((x + 0.5) * camW) / size - 0.5;
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(camW - 1, x0 + 1);
      const wx = Math.min(1, Math.max(0, fx - x0));
      const v =
        cam[y0 * camW + x0] * (1 - wx) * (1 - wy) +
        cam[y0 * camW + x1] * wx * (1 - wy) +
        cam[y1 * camW + x0] * (1 - wx) * wy +
        cam[y1 * camW + x1] * wx * wy;

      const g = gray[y * size + x];
      const [r, gg, b] = inferno(v);
      const a = alpha * Math.pow(v, 1.5); // suppress the cool tail so anatomy stays visible
      const p = (y * size + x) * 4;
      img.data[p] = r * a + g * (1 - a);
      img.data[p + 1] = gg * a + g * (1 - a);
      img.data[p + 2] = b * a + g * (1 - a);
      img.data[p + 3] = 255;
    }
  }
  return img;
}

/** Compact inferno-like colormap. */
function inferno(t: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99],
    [212, 72, 66], [245, 125, 21], [252, 194, 71], [252, 255, 164],
  ];
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
