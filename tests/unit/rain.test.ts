import { describe, it, expect } from "vitest";
import { chooseRainMode, rainBudget } from "@/lib/rain";

describe("chooseRainMode", () => {
  // Case 89 (WS2)
  it("returns static under reduced motion regardless of the other flags", () => {
    for (const offscreenCanvas of [true, false]) {
      for (const saveData of [true, false, undefined]) {
        expect(chooseRainMode({ reducedMotion: true, offscreenCanvas, saveData })).toBe("static");
      }
    }
  });

  it("returns static when saveData is on", () => {
    expect(chooseRainMode({ reducedMotion: false, offscreenCanvas: true, saveData: true })).toBe("static");
    expect(chooseRainMode({ reducedMotion: false, offscreenCanvas: false, saveData: true })).toBe("static");
  });

  it("returns worker when OffscreenCanvas is available and motion is allowed", () => {
    expect(chooseRainMode({ reducedMotion: false, offscreenCanvas: true })).toBe("worker");
    expect(chooseRainMode({ reducedMotion: false, offscreenCanvas: true, saveData: false })).toBe("worker");
  });

  it("falls back to main-thread otherwise", () => {
    expect(chooseRainMode({ reducedMotion: false, offscreenCanvas: false })).toBe("main-thread");
    expect(chooseRainMode({ reducedMotion: false, offscreenCanvas: false, saveData: false })).toBe("main-thread");
  });
});

describe("rainBudget", () => {
  // Case 104 (WS2, rev 4)
  const STATIC = { fps: 0, density: 0.25, maxDpr: 1 };
  const LOW = { fps: 20, density: 0.5, maxDpr: 1 };
  const MID = { fps: 24, density: 0.75, maxDpr: 1 };
  const HIGH = { fps: 30, density: 1, maxDpr: 1.5 };

  it("returns the static budget (fps 0) under reduced motion", () => {
    expect(rainBudget({ reducedMotion: true })).toEqual(STATIC);
    expect(rainBudget({ reducedMotion: true, hardwareConcurrency: 12, deviceMemory: 8 })).toEqual(STATIC);
  });

  it("returns the static budget (fps 0) when Save-Data is on", () => {
    expect(rainBudget({ saveData: true })).toEqual(STATIC);
    expect(rainBudget({ saveData: true, hardwareConcurrency: 12, deviceMemory: 8 })).toEqual(STATIC);
  });

  it("returns the low budget for 4 cores or 2 GB of memory", () => {
    expect(rainBudget({ hardwareConcurrency: 4 })).toEqual(LOW);
    expect(rainBudget({ deviceMemory: 2 })).toEqual(LOW);
  });

  it("returns the high budget for 8 cores with 8 GB, or 12 cores with memory unknown", () => {
    expect(rainBudget({ hardwareConcurrency: 8, deviceMemory: 8 })).toEqual(HIGH);
    expect(rainBudget({ hardwareConcurrency: 12 })).toEqual(HIGH);
  });

  it("returns the mid budget when nothing is known or the device is in between", () => {
    expect(rainBudget({})).toEqual(MID);
    expect(rainBudget({ hardwareConcurrency: 6, deviceMemory: 6 })).toEqual(MID);
  });

  it("keeps every budget within the caps", () => {
    const envs = [
      { reducedMotion: true },
      { saveData: true },
      { hardwareConcurrency: 4 },
      { deviceMemory: 2 },
      { hardwareConcurrency: 8, deviceMemory: 8 },
      { hardwareConcurrency: 12 },
      {},
      { hardwareConcurrency: 6, deviceMemory: 6 },
      { hardwareConcurrency: 64, deviceMemory: 64 },
      { hardwareConcurrency: 1, deviceMemory: 0.5 },
    ];
    for (const env of envs) {
      const b = rainBudget(env);
      const label = JSON.stringify(env);
      expect(b.fps, label).toBeLessThanOrEqual(30);
      expect(b.maxDpr, label).toBeLessThanOrEqual(1.5);
      expect(b.density, label).toBeGreaterThan(0);
      expect(b.density, label).toBeLessThanOrEqual(1);
    }
  });

  it("orders low <= mid <= high in fps and density", () => {
    const low = rainBudget({ hardwareConcurrency: 4 });
    const mid = rainBudget({});
    const high = rainBudget({ hardwareConcurrency: 12 });
    expect(low.fps).toBeLessThanOrEqual(mid.fps);
    expect(mid.fps).toBeLessThanOrEqual(high.fps);
    expect(low.density).toBeLessThanOrEqual(mid.density);
    expect(mid.density).toBeLessThanOrEqual(high.density);
  });
});
