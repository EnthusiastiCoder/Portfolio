import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readSoundPref, writeSoundPref, SOUND_STORAGE_KEY } from "@/lib/audio/sound-pref";
import { FLUID_PALETTES, pickDye, staticGradient } from "@/lib/fluid/palette";

// WS5 fluid-sim-and-sound.

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
}

describe("sound preference", () => {
  it("defaults to off", () => {
    expect(readSoundPref(memoryStorage())).toBe(false);
    expect(readSoundPref(null)).toBe(false);
  });

  it("persists on and off", () => {
    const s = memoryStorage();
    writeSoundPref(true, s);
    expect(s.m.get(SOUND_STORAGE_KEY)).toBe("on");
    expect(readSoundPref(s)).toBe(true);
    writeSoundPref(false, s);
    expect(readSoundPref(s)).toBe(false);
  });

  it("survives a throwing storage", () => {
    const bad = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readSoundPref(bad)).toBe(false);
    expect(() => writeSoundPref(true, bad)).not.toThrow();
  });
});

describe("fluid palette", () => {
  it("red dye is red-dominant, blue dye is blue-dominant", () => {
    for (const [r, g, b] of FLUID_PALETTES.red) expect(r).toBeGreaterThan(Math.max(g, b));
    for (const [r, g, b] of FLUID_PALETTES.blue) expect(b).toBeGreaterThan(Math.max(r, g) - 0.2);
    for (const [r] of FLUID_PALETTES.blue) expect(r).toBeLessThan(0.3);
  });

  it("both (the green personality mode) is green-dominant", () => {
    for (const [r, g, b] of FLUID_PALETTES.both) expect(g).toBeGreaterThan(Math.max(r, b));
  });

  it("pickDye scales a palette colour by the intensity", () => {
    expect(pickDye("red", () => 0, 0.5)).toEqual(FLUID_PALETTES.red[0].map((c) => c * 0.5));
    expect(pickDye("blue", () => 0.999, 1)).toEqual([...FLUID_PALETTES.blue[2]]);
  });

  it("static fallback is a CSS gradient", () => {
    expect(staticGradient("red")).toMatch(/^radial-gradient\(/);
  });
});

describe("lazy loading", () => {
  it("the audio engine is only reached through a dynamic import", () => {
    const toggle = readFileSync("src/components/fluid/SoundToggle.tsx", "utf8");
    expect(toggle).toMatch(/import\("@\/lib\/audio\/engine"\)/);
    expect(toggle).not.toMatch(/^import [^t][^;]*@\/lib\/audio\/engine/m);
  });

  it("the fluid sim is only reached through next/dynamic", () => {
    const loader = readFileSync("src/components/fluid/FluidLoader.tsx", "utf8");
    expect(loader).toMatch(/dynamic\(\(\) => import\("\.\/FluidLayer"\)/);
    expect(loader).not.toMatch(/fluid-sim/);
  });
});
