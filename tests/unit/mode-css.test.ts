import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pillThemes } from "@/config/theme";

// T5 (WS1) and T7 (WS3): static checks on the mode and scroll CSS.

const GLOBALS = path.resolve(process.cwd(), "src/app/globals.css");
const SCROLL = path.resolve(process.cwd(), "src/app/scroll.css");

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function readCss(file: string): string {
  return stripComments(readFileSync(file, "utf8")).replace(/'/g, '"');
}

/** Removes all whitespace so selector checks ignore formatting. */
function squash(s: string): string {
  return s.replace(/\s+/g, "");
}

/** The preludes (selectors or at-rules) of every block enclosing `index`, outermost first. */
function enclosingPreludes(css: string, index: number): string[] {
  const stack: string[] = [];
  let segStart = 0;
  for (let i = 0; i < index; i++) {
    const ch = css[i];
    if (ch === "{") {
      stack.push(css.slice(segStart, i).trim());
      segStart = i + 1;
    } else if (ch === "}") {
      stack.pop();
      segStart = i + 1;
    } else if (ch === ";") {
      segStart = i + 1;
    }
  }
  return stack;
}

function indicesOf(css: string, needle: RegExp): number[] {
  const re = new RegExp(
    needle.source,
    needle.flags.includes("g") ? needle.flags : needle.flags + "g",
  );
  return [...css.matchAll(re)].map((m) => m.index ?? 0);
}

/** Body of the balanced block whose `{` follows `start`. */
function blockBody(css: string, start: number): string {
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return css.slice(open + 1);
}

describe("globals.css mode gating (decision 2)", () => {
  const css = squash(readCss(GLOBALS));

  it.each(["red", "blue", "both"])("hides non-%s variants under html[data-pill]", (p) => {
    expect(css).toContain(squash(`html[data-pill="${p}"] [data-show]:not([data-show~="${p}"])`));
  });

  it("hides non-both variants when data-pill is absent", () => {
    expect(css).toContain(squash(`html:not([data-pill]) [data-show]:not([data-show~="both"])`));
  });

  it("hides them with display: none !important", () => {
    const sel = squash(`html:not([data-pill]) [data-show]:not([data-show~="both"])`);
    const at = css.indexOf(sel);
    expect(at).toBeGreaterThanOrEqual(0);
    const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
    expect(body.toLowerCase()).toContain("display:none!important");
  });
});

describe("globals.css pill palettes (decision 4)", () => {
  const css = readCss(GLOBALS);

  it.each(["red", "blue"] as const)(
    "has an html[data-pill=%s] block with that palette's accent",
    (p) => {
      expect(pillThemes, "pillThemes export").toBeDefined();
      const accent = pillThemes[p].accent.toLowerCase();
      const re = new RegExp(`html\\[data-pill="${p}"\\]\\s*\\{`, "g");
      const starts = indicesOf(css, re);
      expect(starts.length, `html[data-pill="${p}"] { ... }`).toBeGreaterThan(0);
      const bodies = starts.map((s) => blockBody(css, s).toLowerCase());
      expect(
        bodies.some((b) => b.includes(accent)),
        `accent ${accent}`,
      ).toBe(true);
    },
  );
});

describe("globals.css glitch transition (decision 3)", () => {
  const css = readCss(GLOBALS);

  it("defines @keyframes page-glitch", () => {
    expect(css).toMatch(/@keyframes\s+page-glitch\s*\{/);
  });

  it('uses page-glitch only under [data-glitch="on"] and [data-effects="full"]', () => {
    const uses = indicesOf(css, /page-glitch/).filter(
      (i) => !/@keyframes\s+$/.test(css.slice(Math.max(0, i - 20), i)),
    );
    expect(uses.length, "page-glitch is referenced by a rule").toBeGreaterThan(0);
    for (const i of uses) {
      const selectors = squash(
        enclosingPreludes(css, i)
          .filter((p) => !p.startsWith("@"))
          .join(" "),
      );
      expect(selectors, `rule at ${i}`).toContain('[data-glitch="on"]');
      expect(selectors, `rule at ${i}`).toContain('[data-effects="full"]');
    }
  });
});

describe("scroll.css (decision 9)", () => {
  it("exists and is imported by globals.css", () => {
    expect(existsSync(SCROLL), "src/app/scroll.css").toBe(true);
    expect(readCss(GLOBALS)).toMatch(/@import\s+(url\()?"\.\/scroll\.css"/);
  });

  it("guards every animation-timeline with @supports and prefers-reduced-motion: no-preference", () => {
    expect(existsSync(SCROLL), "src/app/scroll.css").toBe(true);
    const css = readCss(SCROLL);
    const uses = indicesOf(css, /animation-timeline\s*:/);
    expect(uses.length, "animation-timeline declarations").toBeGreaterThan(0);
    for (const i of uses) {
      const preludes = enclosingPreludes(css, i).map(squash);
      expect(
        preludes.some((p) => p.startsWith("@supports") && p.includes("(animation-timeline")),
        `@supports around offset ${i}`,
      ).toBe(true);
      expect(
        preludes.some(
          (p) => p.startsWith("@media") && p.includes("(prefers-reduced-motion:no-preference)"),
        ),
        `@media reduced-motion around offset ${i}`,
      ).toBe(true);
    }
  });

  it("never animates layout or filter properties in keyframes", () => {
    expect(existsSync(SCROLL), "src/app/scroll.css").toBe(true);
    const css = readCss(SCROLL);
    const starts = indicesOf(css, /@keyframes\s+[\w-]+\s*\{/);
    expect(starts.length, "@keyframes blocks").toBeGreaterThan(0);
    const banned = /(^|[\s{;])(width|height|top|left|margin(-[a-z]+)?|filter)\s*:/i;
    for (const s of starts) {
      const body = blockBody(css, s);
      expect(body.match(banned)?.[0] ?? null, css.slice(s, css.indexOf("{", s))).toBeNull();
    }
  });

  it.each([".scene-figure", ".sd-heading", ".sd-shot", ".sd-timeline", ".scroll-progress"])(
    "defines a rule for %s",
    (cls) => {
      expect(existsSync(SCROLL), "src/app/scroll.css").toBe(true);
      const css = readCss(SCROLL);
      const re = new RegExp(`${cls.replace(".", "\\.")}(?![\\w-])[^{}]*\\{`);
      expect(css).toMatch(re);
    },
  );
});
