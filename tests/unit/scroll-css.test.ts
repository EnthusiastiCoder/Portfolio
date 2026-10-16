import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// T26: scroll-driven entrance choreography is compositor-only and opt-out-able.
const CSS_PATH = path.resolve(process.cwd(), "src/app/scroll.css");

type Block = { prelude: string; body: string; children: Block[] };

/** Minimal nested CSS parser: strips comments, matches braces recursively. */
function parse(css: string): Block[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: Block[] = [];
  let i = 0;
  let start = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") {
      const prelude = src.slice(start, i).trim().split(";").pop()!.trim();
      let depth = 1;
      let j = i + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") depth--;
        j++;
      }
      const body = src.slice(i + 1, j - 1);
      blocks.push({ prelude, body, children: parse(body) });
      i = j;
      start = j;
    } else {
      i++;
    }
  }
  return blocks;
}

function walk(blocks: Block[], fn: (b: Block, parents: Block[]) => void, parents: Block[] = []) {
  for (const b of blocks) {
    fn(b, parents);
    walk(b.children, fn, [...parents, b]);
  }
}

/** Declarations directly in a block (nested blocks removed). */
function declarations(body: string): { prop: string; value: string }[] {
  let flat = "";
  let depth = 0;
  for (const ch of body) {
    if (ch === "{") depth++;
    if (depth === 0) flat += ch;
    if (ch === "}") depth--;
  }
  // Drop the preludes of nested blocks left behind (text before a removed `{`).
  return flat
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d.includes(":"))
    .map((d) => {
      const k = d.indexOf(":");
      return { prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim() };
    })
    .filter((d) => /^-?[a-z-]+$/.test(d.prop));
}

const css = readFileSync(CSS_PATH, "utf8");
const tree = parse(css);

const keyframes = new Map<string, Block>();
walk(tree, (b) => {
  const m = b.prelude.match(/^@(?:-webkit-)?keyframes\s+([\w-]+)/);
  if (m) keyframes.set(m[1], b);
});

const ALLOWED = new Set(["transform", "opacity", "translate", "scale", "rotate"]);
const ENTRANCES = ["left", "right", "top", "bottom", "depth-in", "depth-out", "rotate"];

function animationNames(decls: { prop: string; value: string }[]): string[] {
  const names: string[] = [];
  for (const d of decls) {
    if (d.prop !== "animation" && d.prop !== "animation-name") continue;
    for (const part of d.value.split(",")) {
      for (const token of part.trim().split(/\s+/)) names.push(token.replace(/!important$/, ""));
    }
  }
  return names;
}

const disablesAnimation = (decls: { prop: string; value: string }[]) =>
  decls.some(
    (d) =>
      (d.prop === "animation" || d.prop === "animation-name") &&
      /^none(\s*!important)?$/.test(d.value),
  );

describe("scroll.css choreography (T26)", () => {
  it("has at least one @keyframes block", () => {
    expect(keyframes.size).toBeGreaterThan(0);
  });

  it("animates only compositor-friendly properties inside every @keyframes", () => {
    const bad: string[] = [];
    for (const [name, kf] of keyframes) {
      for (const step of kf.children) {
        for (const d of declarations(step.body)) {
          if (!ALLOWED.has(d.prop)) bad.push(`${name} ${step.prelude}: ${d.prop}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it.each(ENTRANCES)('has a [data-enter="%s"] rule wired to an existing @keyframes', (dir) => {
    const selectorRe = new RegExp(`\\[data-enter=["']?${dir}["']?\\]`);
    let wired = false;
    walk(tree, (b) => {
      if (!selectorRe.test(b.prelude)) return;
      if (animationNames(declarations(b.body)).some((n) => keyframes.has(n))) wired = true;
    });
    expect(wired).toBe(true);
  });

  it("turns [data-enter] animations off under prefers-reduced-motion: reduce", () => {
    let found = false;
    walk(tree, (b, parents) => {
      if (!b.prelude.includes("[data-enter")) return;
      const inReduce = parents.some((p) =>
        /@media[^{]*prefers-reduced-motion\s*:\s*reduce/.test(p.prelude),
      );
      if (inReduce && disablesAnimation(declarations(b.body))) found = true;
    });
    expect(found).toBe(true);
  });

  it('turns [data-enter] animations off under [data-effects="calm"]', () => {
    let found = false;
    walk(tree, (b) => {
      if (!/\[data-effects=["']?calm["']?\]/.test(b.prelude)) return;
      if (!b.prelude.includes("[data-enter")) return;
      if (disablesAnimation(declarations(b.body))) found = true;
    });
    expect(found).toBe(true);
  });
});
