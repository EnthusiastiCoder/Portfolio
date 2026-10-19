"use client";

import { useEffect } from "react";
import { matrixTheme } from "@/config/theme";
import { readEffects, subscribeEffects } from "@/lib/effects";
import { chooseRainMode, rainBudget, staticRainBudget, type RainMode } from "@/lib/rain";
import {
  createRainRenderer,
  type RainFrameConfig,
  type RainRenderer,
  type RainStyle,
} from "./rain-core";
import type { RainWorkerMessage, RainWorkerReply } from "./rain-messages";

type RainNavigator = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

const STYLE: RainStyle = {
  glyphs: matrixTheme.rain.glyphs,
  fontSize: matrixTheme.rain.fontSize,
  fontFamily: matrixTheme.rain.fontFamily,
  colors: {
    background: matrixTheme.colors.background,
    accent: matrixTheme.colors.accent,
    accentDim: matrixTheme.colors.accentDim,
    rainHead: matrixTheme.colors.rainHead,
  },
};

const RESIZE_DEBOUNCE_MS = 200;
/** Ignore small height changes (mobile URL bar showing and hiding). */
const HEIGHT_SLACK_PX = 120;
/** At most one pointer wake per this many ms (the rain runs at 30 fps or less). */
const WAKE_THROTTLE_MS = 33;

/**
 * Full-screen digital rain behind the page. Runs in an OffscreenCanvas worker
 * where supported, else on the main thread throttled to the budgeted fps.
 * Static under reduced motion, Save-Data or the calm effects level.
 */
export default function MatrixRain() {
  useEffect(() => {
    // Created imperatively: a canvas can be transferred to a worker only once, so each
    // mount (including Strict Mode's second run) gets a fresh element.
    const canvas = document.createElement("canvas");
    canvas.className = "matrix-rain";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("role", "presentation");
    canvas.dataset.testid = "matrix-rain";
    document.body.append(canvas);
    const setMode = (mode: RainMode) => {
      canvas.dataset.mode = mode;
    };
    const nav = navigator as RainNavigator;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const canUseWorker =
      typeof canvas.transferControlToOffscreen === "function" && typeof Worker !== "undefined";

    let worker: Worker | null = null;
    let renderer: RainRenderer | null = null;
    let size = { width: 0, height: 0 };
    let heroVisible = true;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    function measure() {
      const rect = canvas.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    }

    function currentConfig(): { mode: RainMode; config: RainFrameConfig } {
      const reducedMotion = motionQuery.matches;
      const saveData = Boolean(nav.connection?.saveData);
      const calm = readEffects() === "calm";
      const budget = calm
        ? staticRainBudget
        : rainBudget({
            hardwareConcurrency: nav.hardwareConcurrency,
            deviceMemory: nav.deviceMemory,
            saveData,
            reducedMotion,
          });
      const next = chooseRainMode({
        reducedMotion: reducedMotion || budget.fps === 0,
        offscreenCanvas: worker !== null,
        saveData,
      });
      const dpr = Math.min(window.devicePixelRatio || 1, budget.maxDpr);
      return {
        mode: next,
        config: { ...size, dpr, budget: { fps: budget.fps, density: budget.density } },
      };
    }

    function post(message: RainWorkerMessage, transfer: Transferable[] = []) {
      worker?.postMessage(message, transfer);
    }

    const paused = () => document.hidden || !heroVisible;

    function syncPaused() {
      if (worker) post({ type: paused() ? "pause" : "resume" });
      else if (renderer) {
        if (paused()) renderer.pause();
        else renderer.resume();
      }
    }

    function reconfigure() {
      const { mode: next, config } = currentConfig();
      if (worker) post({ type: "configure", config });
      else renderer?.configure(config);
      setMode(next);
    }

    // Start.
    size = measure();
    const initial = currentConfig();
    let started = false;
    if (canUseWorker) {
      try {
        const offscreen = canvas.transferControlToOffscreen();
        worker = new Worker(new URL("./rain.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<RainWorkerReply>) => {
          if (event.data.type === "frames") canvas.dataset.frames = String(event.data.count);
        };
        post(
          {
            type: "init",
            canvas: offscreen,
            style: STYLE,
            config: initial.config,
            paused: paused(),
          },
          [offscreen],
        );
        started = true;
      } catch {
        worker?.terminate();
        worker = null;
      }
    }
    if (!started) {
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        canvas.remove();
        return;
      }
      renderer = createRainRenderer(canvas, ctx, STYLE, {
        request: (cb) => window.requestAnimationFrame(cb),
        cancel: (handle) => window.cancelAnimationFrame(handle),
      });
      renderer.configure(initial.config);
      syncPaused();
    }
    setMode(currentConfig().mode);

    // Live updates.
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const next = measure();
        if (
          next.width === size.width &&
          Math.abs(next.height - size.height) < HEIGHT_SLACK_PX &&
          next.height <= size.height
        ) {
          return;
        }
        size = next;
        reconfigure();
      }, RESIZE_DEBOUNCE_MS);
    };
    const onProbe = () => post({ type: "frames" });
    // Pointer wake: nearby columns brighten and drop faster. The renderer ignores
    // it when the rain is static (reduced motion, calm, Save-Data) or paused.
    let lastWake = 0;
    const onPointer = (event: PointerEvent) => {
      if (paused() || event.timeStamp - lastWake < WAKE_THROTTLE_MS) return;
      lastWake = event.timeStamp;
      if (worker) post({ type: "wake", x: event.clientX, y: event.clientY });
      else renderer?.wake(event.clientX, event.clientY);
    };
    const unsubscribeEffects = subscribeEffects(reconfigure);
    motionQuery.addEventListener("change", reconfigure);
    document.addEventListener("visibilitychange", syncPaused);
    window.addEventListener("resize", onResize);
    window.addEventListener("matrix-rain-probe", onProbe);
    window.addEventListener("pointermove", onPointer, { passive: true });

    let observer: IntersectionObserver | null = null;
    const hero = document.getElementById("top");
    if (hero && "IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        heroVisible = entries.some((entry) => entry.isIntersecting);
        syncPaused();
      });
      observer.observe(hero);
    }

    return () => {
      clearTimeout(resizeTimer);
      unsubscribeEffects();
      motionQuery.removeEventListener("change", reconfigure);
      document.removeEventListener("visibilitychange", syncPaused);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("matrix-rain-probe", onProbe);
      window.removeEventListener("pointermove", onPointer);
      observer?.disconnect();
      worker?.terminate();
      renderer?.destroy();
      canvas.remove();
    };
  }, []);

  return null;
}
