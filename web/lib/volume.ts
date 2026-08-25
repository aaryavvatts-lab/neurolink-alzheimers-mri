/**
 * Loading and cutting through a stack of brain slices.
 *
 * Each scan arrives as one PNG holding all 61 slices in a grid. Decoded and
 * stacked in order it becomes a small 3D block of brightness values, which
 * means the other two viewing planes can be cut straight out of it. That is
 * what radiology software calls multiplanar reconstruction, and it works here
 * because the slices were always a volume; they were only stored as separate
 * pictures.
 */

export interface VolumeMeta {
  id: string;
  subject: string;
  scan: string;
  label: number;
  label_name: string;
  depth: number;
  size: number;
  cols: number;
  rows: number;
  slice_start: number;
  slice_end: number;
  sheet: string;
  per_slice_probs: number[][];
  mean_probs: number[];
  volume_pred: number;
}

export interface Volume {
  meta: VolumeMeta;
  /** depth * size * size brightness values, 0 to 255, ordered slice by slice. */
  data: Uint8Array;
}

export async function loadVolume(meta: VolumeMeta): Promise<Volume> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error(`Could not load ${meta.sheet}`));
    img.src = `/${meta.sheet}`;
  });

  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const sheet = ctx.getImageData(0, 0, c.width, c.height).data;

  const { size, cols, depth } = meta;
  const data = new Uint8Array(depth * size * size);
  for (let k = 0; k < depth; k++) {
    const gx = (k % cols) * size;
    const gy = Math.floor(k / cols) * size;
    for (let y = 0; y < size; y++) {
      const rowOff = ((gy + y) * c.width + gx) * 4;
      const dstOff = k * size * size + y * size;
      for (let x = 0; x < size; x++) data[dstOff + x] = sheet[rowOff + x * 4];
    }
  }
  return { meta, data };
}

export type Plane = "axial" | "coronal" | "sagittal";

/** Dimensions of one view, before any display stretching. */
export function planeSize(v: Volume, plane: Plane): [number, number] {
  const { size, depth } = v.meta;
  if (plane === "axial") return [size, size];
  return [size, depth]; // width across the head, height through the stack
}

/** How far you can move the slider on a given plane. */
export function planeDepth(v: Volume, plane: Plane): number {
  return plane === "axial" ? v.meta.depth : v.meta.size;
}

/**
 * Cut one image out of the block.
 *
 * axial     the slices as they were captured, looking down through the head
 * coronal   cut front to back, rebuilt by walking the stack
 * sagittal  cut left to right, rebuilt the same way
 *
 * The two rebuilt views are drawn with the stack running bottom to top, so the
 * top of the head is at the top of the picture.
 */
export function extractPlane(v: Volume, plane: Plane, index: number): ImageData {
  const { size, depth } = v.meta;
  const [w, h] = planeSize(v, plane);
  const out = new ImageData(w, h);

  const put = (px: number, py: number, val: number) => {
    const o = (py * w + px) * 4;
    out.data[o] = val; out.data[o + 1] = val; out.data[o + 2] = val; out.data[o + 3] = 255;
  };

  if (plane === "axial") {
    const base = Math.min(depth - 1, Math.max(0, index)) * size * size;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) put(x, y, v.data[base + y * size + x]);
    return out;
  }

  const i = Math.min(size - 1, Math.max(0, index));
  for (let d = 0; d < depth; d++) {
    const sliceBase = d * size * size;
    const py = depth - 1 - d; // top of the head at the top of the picture
    for (let x = 0; x < size; x++) {
      const val = plane === "coronal"
        ? v.data[sliceBase + i * size + x]   // fixed row, walk across
        : v.data[sliceBase + x * size + i];  // fixed column, walk down
      put(x, py, val);
    }
  }
  return out;
}

/** Brightest value in the whole block, used to keep contrast steady between views. */
export function volumeMax(v: Volume): number {
  let m = 0;
  for (let i = 0; i < v.data.length; i += 7) if (v.data[i] > m) m = v.data[i];
  return m || 255;
}
