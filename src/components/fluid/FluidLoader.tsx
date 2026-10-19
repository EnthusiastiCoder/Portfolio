"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motionAllowed } from "@/lib/render-budget";
import SoundToggle from "./SoundToggle";
import "./fluid.css";

const FluidLayer = dynamic(() => import("./FluidLayer"), { ssr: false });

/**
 * First-load stub for the fluid layer: the sound toggle and the cursor CSS
 * ship now; the WebGL sim is fetched only after `load` and an idle period, so
 * it never competes with LCP or counts toward first-load JS. Under reduced
 * motion or calm effects the sim never loads; a static CSS gradient shows.
 */
export default function FluidLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(() => setReady(true), { timeout: 2500 });
      } else {
        timer = setTimeout(() => setReady(true), 400);
      }
    };
    if (!motionAllowed()) return;
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {/* Reduced motion or calm effects: this frozen gradient instead of the sim (CSS-gated, no JS). */}
      <div className="fluid-static" aria-hidden="true" />
      {ready ? <FluidLayer /> : null}
      <SoundToggle />
    </>
  );
}
