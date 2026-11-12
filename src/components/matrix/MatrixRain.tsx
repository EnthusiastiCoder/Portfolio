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
