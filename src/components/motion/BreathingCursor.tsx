"use client";

import { useEffect, useState } from "react";
import { readPill, subscribePill } from "@/lib/pill";

const LERP = 0.15;

function wanted(): boolean {
  return (
    readPill() === "blue" &&
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Blue only, fine pointers only, never under reduced motion: a 40 px ring that
 * eases after the pointer (lerp 0.15) and breathes between 38 and 42 px.
 * Decorative: aria-hidden, pointer-events none, and the native cursor stays.
 */
export default function BreathingCursor() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(wanted());
    sync();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(pointer: fine)");
    const unsubscribe = subscribePill(sync);
    motion.addEventListener("change", sync);
    pointer.addEventListener("change", sync);
    return () => {
      unsubscribe();
      motion.removeEventListener("change", sync);
      pointer.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!on) return;
    const ring = document.querySelector<HTMLElement>("[data-cursor]");
    if (!ring) return;
    let x = -100;
    let y = -100;
    let tx = x;
    let ty = y;
    let frame = 0;

    const tick = () => {
      x += (tx - x) * LERP;
      y += (ty - y) * LERP;
      ring.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      tx = event.clientX;
      ty = event.clientY;
      if (ring.dataset.cursor !== "on") {
        x = tx;
        y = ty;
        ring.dataset.cursor = "on";
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      ring.dataset.cursor = "";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [on]);

  if (!on) return null;
  return (
    <div data-cursor="" className="breathing-cursor" aria-hidden="true">
      <span className="breathing-cursor-ring" />
    </div>
  );
}
