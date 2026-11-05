"use client";

import { useEffect } from "react";

/**
 * Attaches the rain canvas as soon as the page hydrates, then fetches the rain
 * module and starts it. The rain is the backdrop, so it does not wait for
 * `load` or an idle period, and it never queues behind the fluid or the 3D
 * scene: the canvas is a cheap DOM append, and where OffscreenCanvas is
 * supported every frame is drawn in a worker, off the main thread.
 */
export default function RainLoader() {
  useEffect(() => {
    // Created imperatively: a canvas can be transferred to a worker only once, so each
    // mount (including Strict Mode's second run) gets a fresh element.
    const canvas = document.createElement("canvas");
    canvas.className = "matrix-rain";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("role", "presentation");
    canvas.dataset.testid = "matrix-rain";
    document.body.append(canvas);

    let stop: (() => void) | undefined;
    let cancelled = false;
    import("./MatrixRain")
      .then(({ startMatrixRain }) => {
        if (!cancelled) stop = startMatrixRain(canvas);
      })
      .catch(() => canvas.remove());
    return () => {
      cancelled = true;
      if (stop) stop();
      else canvas.remove();
    };
  }, []);

  return null;
}
