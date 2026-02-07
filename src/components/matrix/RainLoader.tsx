"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MatrixRain = dynamic(() => import("./MatrixRain"), { ssr: false });

/** Fetches and starts the rain only after `load` and an idle period, so it never competes with LCP. */
export default function RainLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idleHandle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => setReady(true), { timeout: 2000 });
      } else {
        timer = setTimeout(() => setReady(true), 300);
      }
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      clearTimeout(timer);
    };
  }, []);

  return ready ? <MatrixRain /> : null;
}
