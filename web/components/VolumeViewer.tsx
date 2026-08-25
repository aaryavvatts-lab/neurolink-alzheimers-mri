"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  extractPlane, loadVolume, planeDepth, planeSize,
  type Plane, type Volume, type VolumeMeta,
} from "@/lib/volume";
import { SHORT } from "@/lib/types";
import { STAGE, C } from "./charts/primitives";
import { Callout } from "./ui";

const PLANES: [Plane, string, string][] = [
  ["axial", "Axial", "looking down through the head, as captured"],
  ["coronal", "Coronal", "cut front to back, rebuilt from the stack"],
  ["sagittal", "Sagittal", "cut left to right, rebuilt from the stack"],
];

function PlaneCanvas({
  vol, plane, index, onIndex, highlight,
}: {
  vol: Volume; plane: Plane; index: number;
  onIndex: (n: number) => void; highlight?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, h] = planeSize(vol, plane);
  const max = planeDepth(vol, plane);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = w; cv.height = h;
    cv.getContext("2d")!.putImageData(extractPlane(vol, plane, index), 0, 0);
  }, [vol, plane, index, w, h]);

  return (
    <div>
      <div className="relative border border-rule bg-black">
        <canvas
          ref={ref}
          className="block w-full"
          style={{ aspectRatio: "1 / 1", objectFit: "contain", imageRendering: "auto" }}
          aria-label={`${plane} view, position ${index + 1} of ${max}`}
        />
        {highlight !== undefined && plane === "axial" && (
          <div className="pointer-events-none absolute inset-x-0 h-px bg-white/40"
               style={{ top: `${(highlight / max) * 100}%` }} />
        )}
      </div>
      <input
        type="range" min={0} max={max - 1} value={index}
        onChange={(e) => onIndex(Number(e.target.value))}
        aria-label={`Move through the ${plane} view`}
        className="mt-2 w-full accent-[#1D5B8F]"
      />
    </div>
  );
}

/** Three planes placed in 3D, rotated by dragging. */
function CutawayBox({ vol, ax, cor, sag }: {
  vol: Volume; ax: number; cor: number; sag: number;
}) {
  const [rot, setRot] = useState({ x: -18, y: -32 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const refs = {
    axial: useRef<HTMLCanvasElement>(null),
    coronal: useRef<HTMLCanvasElement>(null),
    sagittal: useRef<HTMLCanvasElement>(null),
  };

  useEffect(() => {
    ([["axial", ax], ["coronal", cor], ["sagittal", sag]] as [Plane, number][]).forEach(
      ([p, i]) => {
        const cv = refs[p].current;
        if (!cv) return;
        const [w, h] = planeSize(vol, p);
        cv.width = w; cv.height = h;
        cv.getContext("2d")!.putImageData(extractPlane(vol, p, i), 0, 0);
      }
    );
  }, [vol, ax, cor, sag]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setRot((r) => ({
      x: Math.max(-85, Math.min(85, r.x - dy * 0.4)),
      y: r.y + dx * 0.4,
    }));
  };
  const onUp = () => { drag.current = null; };

  const S = 230;
  const face = "absolute left-1/2 top-1/2 border border-white/25";
  const style = (t: string): React.CSSProperties => ({
    width: S, height: S, marginLeft: -S / 2, marginTop: -S / 2,
    transform: t, transformStyle: "preserve-3d",
  });

  return (
    <div>
      <div
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        role="application"
        aria-label="Three cut planes shown together in three dimensions. Drag to rotate, or use the arrow keys."
        tabIndex={0}
        onKeyDown={(e) => {
          const step = 6;
          if (e.key === "ArrowLeft") setRot((r) => ({ ...r, y: r.y - step }));
          if (e.key === "ArrowRight") setRot((r) => ({ ...r, y: r.y + step }));
          if (e.key === "ArrowUp") setRot((r) => ({ ...r, x: Math.min(85, r.x + step) }));
          if (e.key === "ArrowDown") setRot((r) => ({ ...r, x: Math.max(-85, r.x - step) }));
        }}
        className="relative h-[340px] cursor-grab touch-none select-none overflow-hidden border border-rule bg-black active:cursor-grabbing"
        style={{ perspective: "900px" }}
      >
        <div className="absolute inset-0" style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          transition: drag.current ? "none" : "transform 120ms linear",
        }}>
          {/* axial lies flat, raised to the current slice height */}
          <canvas ref={refs.axial} className={face}
                  style={style(`translateZ(0px) rotateX(90deg) translateZ(${(0.5 - ax / vol.meta.depth) * S}px)`)} />
          {/* coronal stands upright, front to back */}
          <canvas ref={refs.coronal} className={face}
                  style={style(`translateZ(${(cor / vol.meta.size - 0.5) * S}px)`)} />
          {/* sagittal stands upright, side to side */}
          <canvas ref={refs.sagittal} className={face}
                  style={style(`rotateY(90deg) translateZ(${(0.5 - sag / vol.meta.size) * S}px)`)} />
        </div>

        <p className="pointer-events-none absolute bottom-2 left-3 text-[0.75rem] text-white/60">
          drag to rotate
        </p>
      </div>
    </div>
  );
}

export default function VolumeViewer() {
  const [list, setList] = useState<VolumeMeta[]>([]);
  const [vol, setVol] = useState<Volume | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ax, setAx] = useState(30);
  const [cor, setCor] = useState(64);
  const [sag, setSag] = useState(64);

  useEffect(() => {
    fetch("/volumes/index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((v: VolumeMeta[]) => { setList(v); if (v.length) pick(v[0]); })
      .catch(() => setErr("No scans have been exported yet."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback(async (m: VolumeMeta) => {
    setBusy(true); setErr(null);
    try {
      const v = await loadVolume(m);
      setVol(v);
      setAx(Math.floor(m.depth * 0.55));
      setCor(Math.floor(m.size / 2));
      setSag(Math.floor(m.size / 2));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const profile = useMemo(() => {
    if (!vol) return null;
    const p = vol.meta.per_slice_probs;
    const W = 560, H = 150, PAD = { t: 10, r: 10, b: 28, l: 34 };
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    const X = (i: number) => PAD.l + (i / (p.length - 1)) * iw;
    const Y = (v: number) => PAD.t + (1 - v) * ih;
    return { p, W, H, PAD, iw, ih, X, Y };
  }, [vol]);

  return (
    <div className="space-y-6">
      {/* patient picker */}
      <div className="flex flex-wrap gap-2">
        {list.map((m) => (
          <button
            key={m.id} type="button" onClick={() => pick(m)} disabled={busy}
            aria-pressed={vol?.meta.id === m.id}
            className={`border px-3 py-2 text-left text-[0.8125rem] transition ${
              vol?.meta.id === m.id ? "border-ink bg-white" : "border-rule bg-white/60 hover:border-steel"
            } disabled:opacity-50`}
          >
            <span className="block font-mono text-[0.75rem] text-muted">{m.subject}</span>
            <span className="block" style={{ color: STAGE[m.label] }}>{m.label_name}</span>
          </button>
        ))}
      </div>

      {err && <Callout tone="warn">{err}</Callout>}
      {busy && <p className="p-small">Loading the scan.</p>}

      {vol && (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div>
              <CutawayBox vol={vol} ax={ax} cor={cor} sag={sag} />
              <p className="mt-2 p-small">
                The three cuts shown where they actually sit inside the head. Move any slider
                and the matching plane moves with it.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {PLANES.map(([p, title, sub]) => (
                <div key={p}>
                  <p className="mb-1.5 text-[0.8125rem] font-medium text-ink">{title}</p>
                  <PlaneCanvas
                    vol={vol} plane={p}
                    index={p === "axial" ? ax : p === "coronal" ? cor : sag}
                    onIndex={p === "axial" ? setAx : p === "coronal" ? setCor : setSag}
                  />
                  <p className="mt-1 text-[0.6875rem] leading-snug text-muted">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* prediction through the head */}
          {profile && (
            <figure className="fig">
              <figcaption className="border-b border-t-0 border-rule px-4 py-3">
                <span className="font-sans text-[0.9375rem] font-medium text-ink">
                  What the model says at each height
                </span>
                <p className="mt-1 text-[0.8125rem] text-muted">
                  One reading per slice, from the base of the skull up. Drag the axial slider
                  to move the marker.
                </p>
              </figcaption>
              <div className="scroll-x p-4">
                <svg viewBox={`0 0 ${profile.W} ${profile.H}`} width="100%" role="img"
                     aria-label="Model confidence for each stage plotted against slice height.">
                  {[0, 0.5, 1].map((v) => (
                    <g key={v}>
                      <line x1={profile.PAD.l} x2={profile.W - profile.PAD.r}
                            y1={profile.Y(v)} y2={profile.Y(v)} stroke={C.grid} />
                      <text x={profile.PAD.l - 6} y={profile.Y(v) + 4} textAnchor="end"
                            fontSize={10} fill={C.muted}>{v * 100}</text>
                    </g>
                  ))}
                  {[0, 1, 2, 3].map((cls) => (
                    <path key={cls} fill="none" stroke={STAGE[cls]} strokeWidth={1.75}
                          d={profile.p.map((row, i) =>
                            `${i ? "L" : "M"}${profile.X(i)},${profile.Y(row[cls])}`).join(" ")} />
                  ))}
                  <line x1={profile.X(ax)} x2={profile.X(ax)} y1={profile.PAD.t}
                        y2={profile.PAD.t + profile.ih} stroke={C.ink} strokeDasharray="3 3" />
                  <text x={profile.PAD.l} y={profile.H - 8} fontSize={10} fill={C.muted}>
                    base of skull
                  </text>
                  <text x={profile.W - profile.PAD.r} y={profile.H - 8} textAnchor="end"
                        fontSize={10} fill={C.muted}>top of head</text>
                </svg>

                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                  {SHORT.map((s, i) => (
                    <li key={s} className="flex items-center gap-1.5 text-[0.75rem] text-body">
                      <span className="inline-block h-2 w-3" style={{ background: STAGE[i] }} />
                      {s}
                      <span className="tnum text-muted">
                        {(vol.meta.per_slice_probs[ax][i] * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </figure>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="border-t-2 border-rule pt-3">
              <p className="p-small">Clinician said</p>
              <p className="font-serif text-[1.25rem]" style={{ color: STAGE[vol.meta.label] }}>
                {vol.meta.label_name}
              </p>
            </div>
            <div className="border-t-2 border-rule pt-3">
              <p className="p-small">Model, averaged over all {vol.meta.depth} slices</p>
              <p className="font-serif text-[1.25rem]" style={{ color: STAGE[vol.meta.volume_pred] }}>
                {SHORT[vol.meta.volume_pred]}
              </p>
            </div>
            <div className="border-t-2 border-rule pt-3">
              <p className="p-small">This slice alone</p>
              <p className="font-serif text-[1.25rem]"
                 style={{ color: STAGE[vol.meta.per_slice_probs[ax].indexOf(Math.max(...vol.meta.per_slice_probs[ax]))] }}>
                {SHORT[vol.meta.per_slice_probs[ax].indexOf(Math.max(...vol.meta.per_slice_probs[ax]))]}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
