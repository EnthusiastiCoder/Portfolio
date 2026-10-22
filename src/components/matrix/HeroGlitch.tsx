"use client";

import { useEffect } from "react";
import { GLITCH_BURST_MS, GLITCH_GAP_MS, glitchMotionAllowed, pickBetween } from "@/lib/effects";
import { subscribePill } from "@/lib/pill";

/** Delay before the first-reveal burst, so it lands once the name is painted. */
const FIRST_BURST_DELAY_MS = 700;

/**
 * Schedules short glitch bursts on the hero name (`#hero-name.glitch`): one on
 * first reveal, one on every pill mode change, then one every 4 to 9 s. A
 * burst only sets `data-burst` and `--glitch-ms` on the element for 150 to
 * 350 ms; the stepped clip-path and transform keyframes in globals.css do the
 * rest, so nothing runs per frame in JS. Bursts pause while the tab is hidden
 * and never play under reduced motion or calm effects. Renders nothing.
 */
export default function HeroGlitch({ targetId = "hero-name" }: { targetId?: string }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    let gapTimer: ReturnType<typeof setTimeout> | undefined;
    let endTimer: ReturnType<typeof setTimeout> | undefined;

    const end = () => {
      clearTimeout(endTimer);
      el.removeAttribute("data-burst");
    };

    const burst = () => {
      if (document.hidden || !glitchMotionAllowed()) return;
      end();
      const ms = pickBetween(GLITCH_BURST_MS, Math.random());
      el.style.setProperty("--glitch-ms", `${ms}ms`);
      el.setAttribute("data-burst", Math.random() < 0.5 ? "a" : "b");
      endTimer = setTimeout(end, ms);
    };

    const schedule = (delay = pickBetween(GLITCH_GAP_MS, Math.random())) => {
      clearTimeout(gapTimer);
      gapTimer = setTimeout(() => {
        burst();
        schedule();
      }, delay);
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(gapTimer);
        end();
      } else {
        schedule();
      }
    };

    const unsubscribe = subscribePill(() => {
      burst();
      schedule();
    });
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) schedule(FIRST_BURST_DELAY_MS);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(gapTimer);
      end();
    };
  }, [targetId]);

  return null;
}
