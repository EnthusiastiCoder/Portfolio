import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_FLUID_MODE,
  FLUID_MODE_STORAGE_KEY,
  readFluidMode,
  writeFluidMode,
} from "@/lib/fluid/fluid-mode";
import { BLUE_RAIN_SPEED, rainSpeedFor } from "@/lib/rain";
import {
  createRainState,
  stepRain,
  type Rain2D,
  type RainStyle,
} from "@/components/matrix/rain-core";

function memory(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe("fluid mode preference", () => {
  it("defaults to the character mode", () => {
    expect(DEFAULT_FLUID_MODE).toBe("chars");
    expect(readFluidMode(memory())).toBe("chars");
    expect(readFluidMode(null)).toBe("chars");
  });

  it("persists the choice and ignores junk", () => {
    const s = memory();
    writeFluidMode("smoke", s);
    expect(s.getItem(FLUID_MODE_STORAGE_KEY)).toBe("smoke");
    expect(readFluidMode(s)).toBe("smoke");
    s.setItem(FLUID_MODE_STORAGE_KEY, "nope");
    expect(readFluidMode(s)).toBe("chars");
  });

  it("the toggle is an SVG button with an accessible name and no text glyphs", () => {
    const src = readFileSync("src/components/fluid/FluidModeToggle.tsx", "utf8");
    expect(src).toMatch(/aria-label="Fluid through digits"/);
    expect(src).toMatch(/aria-pressed=\{chars\}/);
    expect(src).toMatch(/<svg/);
    expect(readFileSync("src/components/fluid/FluidLoader.tsx", "utf8")).toMatch(
      /<FluidModeToggle \/>/,
    );
  });
});

describe("rain speed per pill", () => {
  it("blue keeps falling, a little slower; red and both run at full speed", () => {
    expect(rainSpeedFor("blue")).toBe(BLUE_RAIN_SPEED);
    expect(BLUE_RAIN_SPEED).toBeGreaterThanOrEqual(0.6);
    expect(BLUE_RAIN_SPEED).toBeLessThanOrEqual(0.7);
    expect(rainSpeedFor("red")).toBe(1);
    expect(rainSpeedFor("both")).toBe(1);
    expect(rainSpeedFor(null)).toBe(1);
  });

  it("stepRain scales the drop by the speed", () => {
    const ctx = {
      fillRect() {},
      fillText() {},
      setTransform() {},
    } as unknown as Rain2D;
    const style: RainStyle = {
      glyphs: "01",
      fontSize: 16,
      fontFamily: "monospace",
      colors: { background: "#000", accent: "#0f0", accentDim: "#080", rainHead: "#fff" },
    };
    const full = createRainState(320, 640, 16, 1, () => 0.5);
    const slow = createRainState(320, 640, 16, 1, () => 0.5);
    const start = full.drops[0];
    stepRain(ctx, full, style);
    stepRain(ctx, slow, style, BLUE_RAIN_SPEED);
    expect(slow.drops[0] - start).toBeCloseTo((full.drops[0] - start) * BLUE_RAIN_SPEED, 5);
    expect(slow.drops[0]).toBeGreaterThan(start);
  });
});
