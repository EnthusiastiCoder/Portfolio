import { createRainRenderer, type RainRenderer, type RainScheduler } from "./rain-core";
import type { RainWorkerMessage, RainWorkerReply } from "./rain-messages";

/** The parts of the dedicated-worker scope this file uses (the DOM lib has no worker types). */
interface RainWorkerScope {
  onmessage: ((event: MessageEvent<RainWorkerMessage>) => void) | null;
  postMessage(message: RainWorkerReply): void;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

const scope = globalThis as unknown as RainWorkerScope;

// Dedicated workers get rAF in Chromium and Firefox; elsewhere fall back to a timer.
const scheduler: RainScheduler =
  typeof scope.requestAnimationFrame === "function"
    ? {
        request: (cb) => scope.requestAnimationFrame!(cb),
        cancel: (handle) => scope.cancelAnimationFrame?.(handle),
      }
    : {
        request: (cb, ms) => scope.setTimeout(() => cb(performance.now()), ms),
        cancel: (handle) => scope.clearTimeout(handle),
      };

let renderer: RainRenderer | null = null;

scope.onmessage = (event) => {
  const msg = event.data;
  switch (msg.type) {
    case "init": {
      const ctx = msg.canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      renderer = createRainRenderer(msg.canvas, ctx, msg.style, scheduler);
      renderer.configure(msg.config);
      if (!msg.paused) renderer.resume();
      scope.postMessage({ type: "ready" });
      break;
    }
    case "configure":
      renderer?.configure(msg.config);
      break;
    case "pause":
      renderer?.pause();
      break;
    case "resume":
      renderer?.resume();
      break;
    case "frames":
      scope.postMessage({ type: "frames", count: renderer?.frames() ?? 0 });
      break;
  }
};
