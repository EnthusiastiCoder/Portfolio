import { describe, it, expect } from "vitest";
import { matrixTheme, pillThemes } from "@/config/theme";

// WCAG 2.x relative luminance and contrast ratio, computed here so the test
// does not trust any helper in src/.
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const REQUIRED = ["background", "surface", "text", "textMuted", "accent", "link", "focus"] as const;

describe("matrixTheme colours", () => {
  // Case 88 (WS2)
  it("defines every required token as a #RRGGBB hex string", () => {
    const colors = matrixTheme.colors as Record<string, string>;
    for (const token of REQUIRED) {
      expect(colors[token], token).toMatch(HEX_RE);
    }
  });

  it("gives text, textMuted, accent and link at least 4.5:1 on background and surface", () => {
    const c = matrixTheme.colors as Record<string, string>;
    for (const fg of ["text", "textMuted", "accent", "link"]) {
      for (const bg of ["background", "surface"]) {
        expect(contrast(c[fg], c[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("gives the focus ring at least 3:1 on background", () => {
    const c = matrixTheme.colors as Record<string, string>;
    expect(contrast(c.focus, c.background)).toBeGreaterThanOrEqual(3);
  });

  it("keeps accent green-dominant and background near-black", () => {
    const c = matrixTheme.colors as Record<string, string>;
    const [r, g, b] = channels(c.accent);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    expect(luminance(c.background)).toBeLessThan(0.02);
  });
});

describe("matrixTheme rain config", () => {
  // Case 88 (WS2)
  it("caps fps at 30 and keeps it positive", () => {
    expect(typeof matrixTheme.rain.fps).toBe("number");
    expect(matrixTheme.rain.fps).toBeGreaterThan(0);
    expect(matrixTheme.rain.fps).toBeLessThanOrEqual(30);
  });

  it("uses half-width katakana and the digits 0-9 as glyphs", () => {
    const glyphs = [...matrixTheme.rain.glyphs];
    const katakana = glyphs.filter((ch) => {
      const cp = ch.codePointAt(0)!;
      return cp >= 0xff66 && cp <= 0xff9d;
    });
    expect(katakana.length).toBeGreaterThanOrEqual(1);
    for (const d of "0123456789") expect(glyphs, `digit ${d}`).toContain(d);
  });
});

// T4 (WS1): the red/blue/both pill palettes.
describe("pillThemes colours", () => {
  const PILL_NAMES = ["red", "blue", "both"] as const;

  it("exports a palette for red, blue and both", () => {
    expect(pillThemes).toBeDefined();
    for (const p of PILL_NAMES) expect(pillThemes[p], p).toBeDefined();
  });

  it.each(PILL_NAMES)("%s defines every token as a #RRGGBB hex string", (p) => {
    expect(pillThemes, "pillThemes export").toBeDefined();
    const colors = pillThemes[p] as Record<string, string>;
    for (const token of REQUIRED) {
      expect(colors[token], `${p}.${token}`).toMatch(HEX_RE);
    }
  });

  it.each(PILL_NAMES)(
    "%s gives text, textMuted, accent and link at least 4.5:1 on background and surface",
    (p) => {
      expect(pillThemes, "pillThemes export").toBeDefined();
      const c = pillThemes[p] as Record<string, string>;
      for (const fg of ["text", "textMuted", "accent", "link"]) {
        for (const bg of ["background", "surface"]) {
          expect(contrast(c[fg], c[bg]), `${p}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );

  it.each(PILL_NAMES)("%s gives the focus ring at least 3:1 on background", (p) => {
    expect(pillThemes, "pillThemes export").toBeDefined();
    const c = pillThemes[p] as Record<string, string>;
    expect(contrast(c.focus, c.background), `${p}: focus on background`).toBeGreaterThanOrEqual(3);
  });
});
