import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { BLUE_RAIN_SPEED, rainSpeedFor } from "@/lib/rain";
import {
  createRainState,
  stepRain,
  type Rain2D,
  type RainStyle,
} from "@/components/matrix/rain-core";

describe("fluid through the digits only", () => {
  it("has no smoky mode and no toggle", () => {
    expect(existsSync("src/components/fluid/FluidModeToggle.tsx")).toBe(false);
    expect(existsSync("src/lib/fluid/fluid-mode.ts")).toBe(false);
    expect(readFileSync("src/components/fluid/FluidLoader.tsx", "utf8")).not.toMatch(
      /FluidModeToggle/,
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
