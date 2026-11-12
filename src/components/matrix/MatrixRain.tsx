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
