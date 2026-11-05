"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const PillScene3D = dynamic(() => import("./PillScene3D"), { ssr: false });

/** Longest wait for an idle period after `load` before the scene is fetched anyway. */
const IDLE_TIMEOUT_MS = 2500;

/**
 * First-load stub for the hero's 3D scene. The portrait poster under it is the
 * first paint and the LCP element; three.js and the scene are fetched only
 * after `load` (so after the poster has painted) and an idle period, so they
 * never compete with LCP or hydration and never count toward first-load JS.
 * The scene then mounts in the same fixed-aspect frame over the poster, which
 * steps back only once WebGL has drawn its first frame: no jump, no shift.
 */
export default function PillScene3DLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => setReady(true);
    const afterLoad = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(go, { timeout: IDLE_TIMEOUT_MS });
      } else {
        timer = setTimeout(go, 400);
      }
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    return () => {
      window.removeEventListener("load", afterLoad);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, []);

  return ready ? <PillScene3D /> : null;
}
