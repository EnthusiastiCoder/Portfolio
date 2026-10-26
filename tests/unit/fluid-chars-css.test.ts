import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { matrixTheme } from "@/config/theme";

// Character mode: the dye multiplies over the rain, so any rain pixel between the
// digits that is not exactly black lets the moving dye show through. The rain's
// CSS filter must crush its background and the fade-trail residue to 0.

const FLUID_CSS = path.resolve(process.cwd(), "src/components/fluid/fluid.css");

function charsRainFilter(): string {
  const css = readFileSync(FLUID_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = /html\[data-fluid-mode="chars"\]\[data-fluid-live\]\s+\.matrix-rain\s*\{([^}]*)\}/.exec(
    css,
  );
  const filter = rule ? /filter\s*:\s*([^;]+);/.exec(rule[1]) : null;
  if (!filter) throw new Error("no chars-mode filter on .matrix-rain");
  return filter[1].trim();
}

/** Applies the CSS filter functions (grayscale, brightness, contrast) to one sRGB colour, 0..255. */
function applyFilter(filter: string, rgb: [number, number, number]): number[] {
  let c = rgb.map((v) => v / 255);
  for (const [, fn, arg] of filter.matchAll(/([a-z-]+)\(\s*([\d.]+)\s*\)/g)) {
    const a = Number(arg);
    if (fn === "grayscale") {
      const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      c = c.map((v) => v * (1 - a) + l * a);
    } else if (fn === "brightness") c = c.map((v) => v * a);
    else if (fn === "contrast") c = c.map((v) => (v - 0.5) * a + 0.5);
    else throw new Error(`unexpected filter function ${fn}`);
    c = c.map((v) => Math.min(1, Math.max(0, v)));
  }
  return c.map((v) => Math.round(v * 255));
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

describe("chars mode rain filter", () => {
  const filter = charsRainFilter();
  const bg = hex(matrixTheme.colors.background);

  it("turns the rain background pure black", () => {
    expect(applyFilter(filter, bg)).toEqual([0, 0, 0]);
  });

  it("turns the fade-trail residue pure black", () => {
    // The 9% fade stalls up to ~12 levels above the background per channel in 8 bits.
    const residue: [number, number, number] = [bg[0] + 12, bg[1] + 12, bg[2] + 12];
    expect(applyFilter(filter, residue)).toEqual([0, 0, 0]);
  });

  it("keeps the digits bright", () => {
    for (const color of [matrixTheme.colors.accent, matrixTheme.colors.rainHead]) {
      expect(Math.min(...applyFilter(filter, hex(color)))).toBeGreaterThanOrEqual(240);
    }
    // A trail digit at a third of the accent brightness still shows.
    const dim = hex(matrixTheme.colors.accent).map((v) => Math.round(v / 3)) as [
      number,
      number,
      number,
    ];
    expect(applyFilter(filter, dim)[0]).toBeGreaterThan(60);
  });
});
