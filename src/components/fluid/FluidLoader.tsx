"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { lowPowerDevice, motionAllowed } from "@/lib/render-budget";
import SoundToggle from "./SoundToggle";
import "./fluid.css";

const FluidLayer = dynamic(() => import("./FluidLayer"), { ssr: false });

/** Any of these means the visitor is here and interacting: start the sim now. */
const INPUT_EVENTS = ["pointerdown", "pointermove", "touchstart", "keydown", "wheel"] as const;
/** On phones and low-end machines the sim waits this long after `load` (or for input). */
const LOW_POWER_DELAY_MS = 4000;

/**
 * First-load stub for the fluid layer: the sound toggle and the cursor CSS
 * ship now; the WebGL sim is fetched on the first input, or else after `load`
 * and an idle period (longer on phones and low-end devices), so it never
 * competes with LCP, hydration or the rain, and never counts toward first-load
 * JS. Under reduced motion or calm effects the sim never loads; a static CSS
 * gradient shows.
 */
export default function FluidLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!motionAllowed()) return;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      stopListening();
      setReady(true);
    };
    const stopListening = () => {
      for (const type of INPUT_EVENTS) window.removeEventListener(type, go);
      window.removeEventListener("load", afterLoad);
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(go, { timeout: 2500 });
      } else {
        timer = setTimeout(go, 400);
      }
    };
    function afterLoad() {
      if (lowPowerDevice()) timer = setTimeout(whenIdle, LOW_POWER_DELAY_MS);
      else whenIdle();
    }
    for (const type of INPUT_EVENTS) window.addEventListener(type, go, { passive: true });
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    return () => {
      stopListening();
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
