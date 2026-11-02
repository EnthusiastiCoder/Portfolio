import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");

/** Every rule whose selector mentions the meet-me hit area or figure. */
function rulesFor(re: RegExp): string[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => re.test(m[1]))
    .map((m) => `${m[1].trim()} { ${m[2]} }`);
}

describe("no green glow on the figure", () => {
  const me = rulesFor(/pill-hit--me|pill-hit:not\(\.pill-hit--me\)|data-say="me"/);

  it("applies no shadow or gradient to the meet-me hit area, in any state", () => {
    for (const rule of me) {
      if (/^\.hero-figure:has/.test(rule)) continue;
      expect(rule).not.toMatch(/drop-shadow|box-shadow|gradient|filter\s*:/);
    }
  });

  it("the shared pill glow never targets meet-me", () => {
    const glow = rulesFor(/::before/).filter((r) => /pill-hit/.test(r));
    for (const r of glow) {
      expect(r).not.toMatch(/data-say="me"\]\s*\.pill-hit--me::before/);
      expect(r).not.toMatch(/\.pill-hit--me::before/);
    }
    expect(css).toMatch(/\.pill-hit:not\(\.pill-hit--me\):focus-visible::before/);
  });

  it("keeps a keyboard focus outline on meet-me", () => {
    expect(css).toMatch(/\.pill-hit:focus-visible\s*\{[^}]*outline:\s*2px/);
  });

  it("keeps the red and blue pill glows", () => {
    expect(css).toMatch(/data-say="red"\]\s*\.pill-hit--red::before/);
    expect(css).toMatch(/data-say="blue"\]\s*\.pill-hit--blue::before/);
    expect(css).toMatch(/\.scene-hand--red \.scene-hand-glow/);
    expect(css).toMatch(/\.scene-hand--blue \.scene-hand-glow/);
  });
});
