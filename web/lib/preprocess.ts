/**
 * Browser-side reimplementation of src/neurolink/data/preprocess.py.
 *
 * This file must mirror the Python pipeline step for step. If the two drift, the
 * model receives inputs unlike anything it trained on and the live demo silently
 * lies. That risk is why the site ships each sample's raw JPG alongside the
 * PyTorch probabilities computed on the server: lib/verify.ts re-runs this
 * pipeline on the raw file and checks the browser reproduces the Python result.
 *
 * Pipeline: grayscale -> square resize (undo 2x horizontal stretch) -> head mask
 * -> square bbox crop with margin -> percentile clip inside mask -> resize ->
 * normalise -> 3 channels.
 */

export interface Gray {
  data: Float32Array; // 0..255
  w: number;
  h: number;
}

/** OpenCV's getGaussianKernel(5, sigma=0) => sigma 1.1. Hardcoded to match exactly. */
const GAUSS5 = [0.07076984, 0.24446331, 0.3695337, 0.24446331, 0.07076984];

export function toGray(img: ImageData): Gray {
  const { width: w, height: h, data } = img;
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Channels are identical in this dataset; use OpenCV's BGR2GRAY weights
    // so any non-grayscale upload degrades the same way Python would.
    out[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { data: out, w, h };
}

/** Bilinear resample. Matches cv2.INTER_LINEAR closely enough for our tolerance. */
export function resize(src: Gray, nw: number, nh: number): Gray {
  const out = new Float32Array(nw * nh);
  const sx = src.w / nw;
  const sy = src.h / nh;
  for (let y = 0; y < nh; y++) {
    const fy = Math.min(src.h - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, src.h - 1);
    const wy = fy - y0;
    for (let x = 0; x < nw; x++) {
      const fx = Math.min(src.w - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, src.w - 1);
      const wx = fx - x0;
      const a = src.data[y0 * src.w + x0];
      const b = src.data[y0 * src.w + x1];
      const c = src.data[y1 * src.w + x0];
      const d = src.data[y1 * src.w + x1];
      out[y * nw + x] = a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + c * (1 - wx) * wy + d * wx * wy;
    }
  }
  return { data: out, w: nw, h: nh };
}

function blur5(src: Gray): Gray {
  const { w, h } = src;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += GAUSS5[k + 2] * src.data[y * w + clamp(x + k, 0, w - 1)];
      tmp[y * w + x] = s;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += GAUSS5[k + 2] * tmp[clamp(y + k, 0, h - 1) * w + x];
      out[y * w + x] = s;
    }
  return { data: out, w, h };
}

/** Percentile of a 0..255 array via a 256-bin histogram (exact for 8-bit data). */
export function percentile(vals: Float32Array, idx: Uint8Array | null, p: number): number {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < vals.length; i++) {
    if (idx && !idx[i]) continue;
    hist[Math.max(0, Math.min(255, Math.round(vals[i])))]++;
    n++;
  }
  if (!n) return 0;
  const target = (p / 100) * (n - 1);
  let cum = 0;
  for (let b = 0; b < 256; b++) {
    cum += hist[b];
    if (cum > target) return b;
  }
  return 255;
}

/** Separable max/min filters -- a square structuring element factorises. */
function morph(mask: Uint8Array, w: number, h: number, r: number, dilate: boolean): Uint8Array {
  const pick = dilate ? Math.max : Math.min;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= w) continue;
        v = pick(v, mask[y * w + xx]);
      }
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= h) continue;
        v = pick(v, tmp[yy * w + x]);
      }
      out[y * w + x] = v;
    }
  return out;
}

/**
 * Head mask: low absolute threshold against a zero background, morphological
 * close, largest connected component, holes filled.
 *
 * Deliberately NOT Otsu -- see the docstring in preprocess.py. Otsu picks a
 * tissue-level threshold that fragments dim scans.
 */
export function headMask(g: Gray): Uint8Array {
  const { w, h } = g;
  const thr = Math.max(8, 0.1 * percentile(g.data, null, 99));
  const b = blur5(g);
  const raw = new Uint8Array(w * h);
  for (let i = 0; i < raw.length; i++) raw[i] = b.data[i] > thr ? 1 : 0;

  // Morphological close = dilate then erode with a 9x9 square (r = 4).
  const m = morph(morph(raw, w, h, 4, true), w, h, 4, false);

  // Largest connected component (iterative flood fill; no recursion depth risk).
  const label = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  let best = -1;
  let bestSize = 0;
  let cur = 0;
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || label[s] >= 0) continue;
    let sp = 0;
    stack[sp++] = s;
    label[s] = cur;
    let size = 0;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const px = p % w;
      const py = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (m[q] && label[q] < 0) {
            label[q] = cur;
            stack[sp++] = q;
          }
        }
    }
    if (size > bestSize) {
      bestSize = size;
      best = cur;
    }
    cur++;
  }

  const comp = new Uint8Array(w * h);
  if (best < 0) return comp.fill(1);
  for (let i = 0; i < comp.length; i++) comp[i] = label[i] === best ? 1 : 0;

  // Fill holes: flood the background inward from the border; anything still
  // unset is enclosed by the head and belongs to it (e.g. the ventricles).
  const outside = new Uint8Array(w * h);
  let sp = 0;
  const st = new Int32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (const p of [x, (h - 1) * w + x]) if (!comp[p] && !outside[p]) { outside[p] = 1; st[sp++] = p; }
  }
  for (let y = 0; y < h; y++) {
    for (const p of [y * w, y * w + w - 1]) if (!comp[p] && !outside[p]) { outside[p] = 1; st[sp++] = p; }
  }
  while (sp > 0) {
    const p = st[--sp];
    const px = p % w;
    const py = (p / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (!comp[q] && !outside[q]) { outside[q] = 1; st[sp++] = q; }
    }
  }
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < filled.length; i++) filled[i] = comp[i] || !outside[i] ? 1 : 0;
  return filled;
}

export interface Preprocessed {
  gray: Float32Array;   // size*size, 0..255 (for display)
  tensor: Float32Array; // 3*size*size, normalised (for the model)
  size: number;
}

export function preprocess(img: ImageData, size = 224, margin = 0.04, mean = 0.449, std = 0.226): Preprocessed {
  const g0 = toGray(img);

  // Un-squash: the raw files are 496x248, a 248x248 slice stretched 2x wide.
  const side = Math.max(g0.w, g0.h);
  const sq = g0.w === g0.h ? g0 : resize(g0, side, side);

  const mask = headMask(sq);

  // Square bounding box around the head, with margin, clamped to the frame.
  let y0 = sq.h, y1 = -1, x0 = sq.w, x1 = -1;
  for (let y = 0; y < sq.h; y++)
    for (let x = 0; x < sq.w; x++)
      if (mask[y * sq.w + x]) {
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
  if (y1 < 0) { y0 = 0; x0 = 0; y1 = sq.h - 1; x1 = sq.w - 1; }
  y1 += 1; x1 += 1;

  const cy = (y0 + y1) / 2;
  const cx = (x0 + x1) / 2;
  const half = (Math.max(y1 - y0, x1 - x0) * (1 + 2 * margin)) / 2;
  const cy0 = Math.max(0, Math.round(cy - half));
  const cy1 = Math.min(sq.h, Math.round(cy + half));
  const cx0 = Math.max(0, Math.round(cx - half));
  const cx1 = Math.min(sq.w, Math.round(cx + half));

  const cw = cx1 - cx0;
  const ch = cy1 - cy0;
  const crop = new Float32Array(cw * ch);
  const cmask = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      crop[y * cw + x] = sq.data[(cy0 + y) * sq.w + (cx0 + x)];
      cmask[y * cw + x] = mask[(cy0 + y) * sq.w + (cx0 + x)];
    }

  // Percentiles over head pixels only: over the whole frame they would mostly
  // measure how much black background there is.
  const lo = percentile(crop, cmask, 1);
  let hi = percentile(crop, cmask, 99);
  if (hi <= lo) hi = lo + 1;
  const normed = new Float32Array(cw * ch);
  for (let i = 0; i < crop.length; i++) {
    normed[i] = Math.min(1, Math.max(0, (crop[i] - lo) / (hi - lo))) * 255;
  }

  const final = resize({ data: normed, w: cw, h: ch }, size, size);
  const gray = new Float32Array(size * size);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(final.data[i]);

  const tensor = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    const v = (gray[i] / 255 - mean) / std;
    tensor[i] = v;
    tensor[size * size + i] = v;
    tensor[2 * size * size + i] = v;
  }
  return { gray, tensor, size };
}
