export type RainMode = "worker" | "main-thread" | "static";

export type RainBudget = { fps: number; density: number; maxDpr: number };

export interface RainModeEnv {
  reducedMotion: boolean;
  offscreenCanvas: boolean;
  saveData?: boolean;
}

export interface RainBudgetEnv {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
  reducedMotion?: boolean;
}

/** Picks how the rain renders: a still frame, an OffscreenCanvas worker, or the main thread. */
export function chooseRainMode(env: RainModeEnv): RainMode {
  if (env.reducedMotion) return "static";
  if (env.saveData) return "static";
  return env.offscreenCanvas ? "worker" : "main-thread";
}

const STATIC_BUDGET: RainBudget = { fps: 0, density: 0.25, maxDpr: 1 };
const LOW_BUDGET: RainBudget = { fps: 20, density: 0.5, maxDpr: 1 };
const MID_BUDGET: RainBudget = { fps: 24, density: 0.75, maxDpr: 1 };
const HIGH_BUDGET: RainBudget = { fps: 30, density: 1, maxDpr: 1.5 };
