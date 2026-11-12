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
