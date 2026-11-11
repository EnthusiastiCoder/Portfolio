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
