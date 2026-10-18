"use client";

import { useEffect, useRef } from "react";
import { subscribeScroll } from "@/lib/scroll-progress";

/**
 * Marks the product layer that is currently in front with `data-current`, so
 * only that layer takes clicks (the others are transparent but still stacked
 * over it). Rides the shared scroll listener; no wheel handling. When a
 * keyboard user focuses a link inside another layer, scrolls the page to that
 * layer's part of the stage so the focused link is the one on screen.
 */
export default function StageController() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stage = ref.current?.closest<HTMLElement>("[data-product-stage]");
    if (!stage) return;
    const layers = Array.from(stage.querySelectorAll<HTMLElement>("[data-stage-layer]"));
    if (layers.length === 0) return;
    let current = -1;

    const travel = () => Math.max(1, stage.offsetHeight - window.innerHeight);
    const pinned = () => getComputedStyle(layers[0]).position === "absolute";

    const update = () => {
      const progress = Math.min(1, Math.max(0, -stage.getBoundingClientRect().top / travel()));
      const next = Math.round(progress * (layers.length - 1));
      if (next === current) return;
      current = next;
      layers.forEach((layer, i) => {
        if (i === next) layer.dataset.current = "";
        else delete layer.dataset.current;
      });
    };

    const onFocus = (event: FocusEvent) => {
      if (!pinned()) return;
      const layer = (event.target as Element | null)?.closest<HTMLElement>("[data-stage-layer]");
      const i = layer ? layers.indexOf(layer) : -1;
      if (i < 0 || i === current) return;
      const top = stage.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + (travel() * i) / (layers.length - 1), behavior: "auto" });
    };

    const unsubscribe = subscribeScroll(update);
    stage.addEventListener("focusin", onFocus);
    return () => {
      unsubscribe();
      stage.removeEventListener("focusin", onFocus);
    };
  }, []);

  return <span ref={ref} hidden />;
}
