"use client";

import { useEffect, useState } from "react";
import { readEffects } from "@/lib/effects";
import { prefersReducedMotion } from "@/lib/use-media";

const SESSION_KEY = "matrix-intro";
const DURATION_MS = 800;
const BANDS = ["8%", "34%", "58%", "80%"];

/**
 * A short, text-free glitch sweep shown once per session after first paint.
 * It is client-only (never an LCP candidate), skippable, and absent in calm or
 * under reduced motion.
 */
export default function MatrixIntro() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readEffects() !== "full" || prefersReducedMotion()) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    const timer = window.setTimeout(hide, DURATION_MS);
    window.addEventListener("keydown", hide, { once: true });
    window.addEventListener("pointerdown", hide, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", hide);
      window.removeEventListener("pointerdown", hide);
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="matrix-intro" data-testid="matrix-intro" aria-hidden="true">
      {BANDS.map((top) => (
        <span key={top} style={{ top }} />
      ))}
    </div>
  );
}
