"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadVolume, extractPlane, type Volume, type VolumeMeta } from "@/lib/volume";
import { STAGE, C } from "./charts/primitives";

/**
 * Marks dark pixels well inside the brain and near the middle, then reports how
 * much of the brain they cover.
 *
 * The cutoff is an absolute brightness, not a percentile of this brain. A
 * percentile cannot compare two people: asking for the darkest quarter always
 * returns about a quarter, whoever it is, so both panels would read the same
 * number regardless of how much fluid either brain holds. Preprocessing already
 * puts every scan on the same brightness scale, which is what makes a fixed
 * cutoff comparable between patients.
 */
function measure(img: ImageData, cutoff: number, centreFrac: number) {
  const { width: w, height: h, data } = img;
  const grey = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) grey[i] = data[i * 4];

  // Head: anything meaningfully above black.
  const head = new Uint8Array(w * h);
  for (let i = 0; i < grey.length; i++) head[i] = grey[i] > 22 ? 1 : 0;

  // Pull inward so skull and scalp are excluded, leaving brain.
  //
  // The Python side builds its kernel as np.ones((k, k)) with k about 12% of the
  // image, and a k-wide kernel erodes by k/2. Reading that number as a radius
  // here erodes twice as far, which on some scans removes the brain completely
  // and leaves nothing to measure. Half of it is the matching amount.
  //
  // Even then a head that is thin in places can vanish, so back the radius off
  // until something survives rather than giving up and showing nothing.
  let brain: Uint8Array<ArrayBufferLike> = new Uint8Array(w * h);
  let brainCount = 0;
  for (let r = Math.round(0.055 * Math.min(w, h)); r >= 2; r -= 2) {
    brain = erode(head, w, h, r);
    brainCount = 0;
    for (let i = 0; i < brain.length; i++) if (brain[i]) brainCount++;
    if (brainCount >= 400) break;
  }
  if (brainCount < 200) return null;

  const thr = cutoff;

  const cy = h / 2, cx = w / 2;
  const rad = (centreFrac * Math.min(w, h)) / 2;
  const mask = new Uint8Array(w * h);
  let vent = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!brain[i] || grey[i] > thr) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      mask[i] = 1; vent++;
    }

  return { mask, brain, ventricleArea: vent, brainArea: brainCount,
           ratio: vent / brainCount, threshold: thr, w, h };
}

function erode(mask: Uint8Array, w: number, h: number, r: number): Uint8Array<ArrayBufferLike> {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let k = -r; k <= r && v; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= w || !mask[y * w + xx]) v = 0;
      }
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let k = -r; k <= r && v; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= h || !tmp[yy * w + x]) v = 0;
      }
      out[y * w + x] = v;
    }
  return out;
}

export default function VentricleTool() {
  const [list, setList] = useState<VolumeMeta[]>([]);
  const [vols, setVols] = useState<Record<string, Volume>>({});
  const [pick, setPick] = useState<[string, string] | null>(null);
  const [cutoff, setCutoff] = useState(70);
  // Around here the lateral ventricles are widest in frame, which is where the
  // difference between a healthy brain and an affected one is easiest to see.
  const [slice, setSlice] = useState(20);
  const [stats, setStats] = useState<Record<string, { ratio: number; label: number }>>({});
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    fetch("/volumes/index.json").then((r) => (r.ok ? r.json() : [])).then((v: VolumeMeta[]) => {
      setList(v);
      const healthy = v.find((m) => m.label === 0);
      const affected = v.find((m) => m.label >= 2) ?? v.find((m) => m.label === 1);
      if (healthy && affected) setPick([healthy.id, affected.id]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pick) return;
    pick.forEach(async (id) => {
      if (vols[id]) return;
      const meta = list.find((m) => m.id === id);
      if (!meta) return;
      const v = await loadVolume(meta);
      setVols((prev) => ({ ...prev, [id]: v }));
    });
  }, [pick, list, vols]);

  const render = useCallback(() => {
    if (!pick) return;
    const next: Record<string, { ratio: number; label: number }> = {};
    for (const id of pick) {
      const v = vols[id];
      const cv = refs.current[id];
      if (!v || !cv) continue;
      const idx = Math.min(v.meta.depth - 1, slice);
      const img = extractPlane(v, "axial", idx);
      const m = measure(img, cutoff, 0.5);
      cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext("2d")!;
      if (!m) { ctx.putImageData(img, 0, 0); continue; }
      const shown = new ImageData(img.width, img.height);
      for (let i = 0; i < img.width * img.height; i++) {
        const g = img.data[i * 4];
        const o = i * 4;
        if (m.mask[i]) {
          shown.data[o] = 240; shown.data[o + 1] = 90; shown.data[o + 2] = 70;
        } else {
          shown.data[o] = g; shown.data[o + 1] = g; shown.data[o + 2] = g;
        }
        shown.data[o + 3] = 255;
      }
      ctx.putImageData(shown, 0, 0);
      next[id] = { ratio: m.ratio, label: v.meta.label };
    }
    setStats(next);
  }, [pick, vols, slice, cutoff]);

  useEffect(() => { render(); }, [render]);

  if (!pick) return <p className="p-small">Loading scans.</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {pick.map((id, side) => {
          const meta = list.find((m) => m.id === id);
          const st = stats[id];
          return (
            <div key={id}>
              <label className="mb-2 block">
                <span className="sr-only">Choose a patient for the {side === 0 ? "left" : "right"} panel</span>
                <select
                  value={id}
                  onChange={(e) => setPick((p) =>
                    p ? (side === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]) : p)}
                  className="w-full border border-rule bg-white px-3 py-2 text-[0.875rem]"
                >
                  {list.map((m) => (
                    <option key={m.id} value={m.id}>{m.subject}, {m.label_name}</option>
                  ))}
                </select>
              </label>
              <div className="border border-rule bg-black">
                <canvas
                  ref={(el) => { refs.current[id] = el; }}
                  className="block w-full"
                  aria-label={`Scan of patient ${meta?.subject} with the fluid spaces marked in red`}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[0.8125rem]" style={{ color: STAGE[meta?.label ?? 0] }}>
                  {meta?.label_name}
                </span>
                <span className="tnum font-serif text-[1.25rem] font-semibold text-ink">
                  {st ? `${(st.ratio * 100).toFixed(1)}%` : "n/a"}
                </span>
              </div>
              <p className="p-small">of the brain area is marked as fluid</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[0.875rem] text-body">
            Height through the head, slice {slice + 1}
          </span>
          <input type="range" min={0} max={60} value={slice}
                 onChange={(e) => setSlice(Number(e.target.value))}
                 className="w-full accent-[#1D5B8F]"
                 aria-label="Height through the head" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.875rem] text-body">
            Anything darker than <span className="tnum text-ink">{cutoff}</span> counts as fluid
          </span>
          <input type="range" min={30} max={120} value={cutoff}
                 onChange={(e) => setCutoff(Number(e.target.value))}
                 className="w-full accent-[#1D5B8F]"
                 aria-label="Brightness cutoff below which a pixel counts as fluid" />
          <span className="mt-1 block text-[0.75rem] text-muted">
            Brightness runs 0 for black to 255 for white. The same cutoff is used on both
            panels, which is what makes the two numbers comparable.
          </span>
        </label>
      </div>

      <div className="border-l-2 px-4 py-3" style={{ borderColor: C.steel }}>
        <p className="text-[0.9375rem] leading-relaxed text-body">
          {Object.keys(stats).length === 2 && (() => {
            const [a, b] = pick.map((id) => stats[id]);
            if (!a || !b) return null;
            const higher = a.ratio > b.ratio ? 0 : 1;
            const gap = Math.abs(a.ratio - b.ratio) * 100;
            const worse = a.label > b.label ? 0 : b.label > a.label ? 1 : null;
            if (worse === null) return "Both panels show the same stage, so pick two different ones to compare.";
            return higher === worse
              ? `The more affected patient shows more fluid, by ${gap.toFixed(1)} percentage points at this setting. That is the sign clinicians look for, and it is why a simple measurement gets you surprisingly far.`
              : `At this setting the more affected patient does not show more fluid. Move the slice slider. The difference shows up in the middle of the head, not at the base of the skull, and one slice is a thin piece of evidence.`;
          })()}
        </p>
      </div>
    </div>
  );
}
