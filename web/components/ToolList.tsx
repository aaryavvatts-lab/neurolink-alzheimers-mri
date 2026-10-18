"use client";

import Link from "next/link";
import { useState } from "react";
import Reveal from "@/components/Reveal";
import { TOOLS } from "@/lib/nav";

/* Sticky picture, active list. Hovering or focusing a tool crossfades the slice beside it. */
const PICS = [
  "/pictures/Non_OAS1_0007_128.png",
  "/pictures/Verymild_OAS1_0060_134.png",
  "/pictures/Mild_OAS1_0052_123.png",
  "/pictures/Non_OAS1_0026_130.png",
  "/pictures/Moderate_OAS1_0308_132.png",
  "/pictures/Verymild_OAS1_0003_140.png",
];

export default function ToolList() {
  const [on, setOn] = useState(0);
  return (
    <div className="tools">
      <div className="tools__pic" aria-hidden="true">
        {PICS.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={p} alt="" width={1024} height={1024} loading="lazy" decoding="async" className={i === on ? "is-on" : ""} />
        ))}
      </div>
      <ul className="tools__list">
        {TOOLS.map(([href, name, desc], i) => (
          <Reveal as="li" key={href} className={i === on ? "is-on" : ""} index={i}>
            <Link href={href} onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)}>
              <span className="name">{name}</span>
              <span className="desc">{desc}</span>
            </Link>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
