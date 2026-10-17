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
