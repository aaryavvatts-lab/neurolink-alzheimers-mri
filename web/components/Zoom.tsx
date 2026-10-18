"use client";

import { useEffect, useRef, useState } from "react";

/* One frame, three distances: a sticky frame holds one real slice while the reader scrolls
   through three stages, and the frame zooms toward the ventricles. */
export default function Zoom({ src, alt, first, second, caption }: {
  src: string; alt: string; first: string; second: string; caption: string;
}) {
  const [stage, setStage] = useState(0);
  const marks = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];

  useEffect(() => {
    if (!("IntersectionObserver" in window)) { setStage(2); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const i = marks.findIndex((m) => m.current === en.target);
        if (i >= 0) setStage(i);
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    marks.forEach((m) => m.current && io.observe(m.current));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transform = ["scale(1)", "scale(1.6)", "scale(2.4)"][stage];
  const origin = ["50% 50%", "50% 46%", "50% 46%"][stage];

  return (
    <section className="zoom" data-stage={stage} aria-label="One slice at three distances">
      <div className="zoom__stage wrap">
        <h2>
          <span className="zoom__a">{first}</span>
          <span className="zoom__b">{second}</span>
        </h2>
        <div className="zoom__frame" style={{ gridRow: 2 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} width={1024} height={1024} style={{ transform, transformOrigin: origin }} />
        </div>
        <p className="zoom__cap">{caption}</p>
      </div>
      <div className="zoom__marks" aria-hidden="true">
        <span ref={marks[0]} style={{ top: "20vh" }} />
        <span ref={marks[1]} style={{ top: "120vh" }} />
        <span ref={marks[2]} style={{ top: "220vh" }} />
      </div>
    </section>
  );
}
