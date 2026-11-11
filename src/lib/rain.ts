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
