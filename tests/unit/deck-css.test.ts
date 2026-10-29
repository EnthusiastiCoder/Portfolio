import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// WS2 (plans/2026-11-23_projects-deck-redesign.md): the deck's CSS contract.
// Deck and fan keyframes move by transform only (no opacity), every deck rule is
// behind the motion and animation-timeline gates, reduced motion and calm turn
// it off, and no card or card ancestor ever sets opacity, filter, mask,
// clip-path or mix-blend-mode, so each card's backdrop-filter frosts the rain.

const SCROLL_CSS = readFileSync(path.resolve(process.cwd(), "src/app/scroll.css"), "utf8");
const GLOBALS_CSS = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");

type Block = { prelude: string; body: string; children: Block[] };
type Decl = { prop: string; value: string };

/** Minimal nested CSS parser (as in scroll-css.test.ts): strips comments, matches braces recursively. */
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
function declarations(body: string): Decl[] {
  let flat = "";
  let depth = 0;
  for (const ch of body) {
    if (ch === "{") depth++;
    if (depth === 0) flat += ch;
    if (ch === "}") depth--;
  }
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

/** Splits a selector list on top-level commas (not inside :is(), :not(), attribute values). */
function splitList(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The last compound selector of a complex selector (after the last top-level combinator). */
function lastCompound(selector: string): string {
  let depth = 0;
  let last = 0;
  const s = selector.trim();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (depth === 0 && /[\s>+~]/.test(ch)) last = i + 1;
  }
  return s.slice(last).trim();
}

const isRule = (b: Block) => b.prelude !== "" && !b.prelude.startsWith("@") && !/^(from|to|\d+%)/.test(b.prelude);
const isKeyframes = (b: Block) => /^@(?:-webkit-)?keyframes\s/.test(b.prelude);

const scrollTree = parse(SCROLL_CSS);
const globalsTree = parse(GLOBALS_CSS);

/** Every style rule (not inside @keyframes) with its parents. */
function rules(tree: Block[]): { block: Block; parents: Block[] }[] {
  const out: { block: Block; parents: Block[] }[] = [];
  walk(tree, (b, parents) => {
    if (!isRule(b) || parents.some(isKeyframes)) return;
    out.push({ block: b, parents });
  });
  return out;
}

const keyframes = new Map<string, Block>();
walk(scrollTree, (b) => {
  const m = b.prelude.match(/^@(?:-webkit-)?keyframes\s+([\w-]+)/);
  if (m) keyframes.set(m[1], b);
});

const disablesAnimation = (decls: Decl[]) =>
  decls.length > 0 &&
  decls.every(
    (d) =>
      (d.prop === "animation" || d.prop === "animation-name") &&
      /^none\s*(!important)?$/.test(d.value),
  );

const inNoPreference = (parents: Block[]) =>
  parents.some((p) => /@media[^{]*prefers-reduced-motion\s*:\s*no-preference/.test(p.prelude));
const inTimelineSupports = (parents: Block[]) =>
  parents.some((p) => /@supports[^{]*animation-timeline\s*:\s*view\(\)/.test(p.prelude));
const inReduce = (parents: Block[]) =>
  parents.some((p) => /@media[^{]*prefers-reduced-motion\s*:\s*reduce/.test(p.prelude));

/** Tokens that name a deck card or one of its ancestors. */
const CARD_OR_ANCESTOR = [
  /\[data-deck\]/,
  /\[data-deck-pin\]/,
  /\[data-deck-card\]/,
  /\.deck(?![\w-])/,
  /\.deck-pin(?![\w-])/,
  /\.deck-card(?![\w-])/,
  /\.projects-flow(?![\w-])/,
  /\.sect--projects(?![\w-])/,
];

const FAN = /\.fan-card(?![\w-])|\[data-fan-card\]|\.ov-fan(?![\w-])|\[data-fan\]/;

describe("deck CSS (WS2)", () => {
  it("C1: deck-* and fan-* keyframes exist and move by transform only, never opacity", () => {
    for (const name of ["deck-rise2", "deck-rise1", "deck-peel", "fan-open"]) {
      expect(keyframes.has(name), `@keyframes ${name}`).toBe(true);
    }
    const allowed = new Set(["transform", "translate", "rotate", "scale"]);
    const bad: string[] = [];
    for (const [name, kf] of keyframes) {
      if (!/^(deck|fan)-/.test(name)) continue;
      for (const step of kf.children) {
        for (const d of declarations(step.body)) {
          if (!allowed.has(d.prop)) bad.push(`${name} ${step.prelude}: ${d.prop}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("C2: every [data-deck rule in scroll.css is gated by no-preference and animation-timeline support; the pin is sticky", () => {
    const deckRules = rules(scrollTree).filter(({ block }) => block.prelude.includes("[data-deck"));
    expect(deckRules.length, "deck rules in scroll.css").toBeGreaterThan(0);
    const ungated: string[] = [];
    let pinSticky = false;
    for (const { block, parents } of deckRules) {
      const decls = declarations(block.body);
      // The reduced-motion and calm opt-outs live outside the gates by design.
      const optOut =
        disablesAnimation(decls) &&
        (inReduce(parents) || /\[data-effects=["']?calm["']?\]/.test(block.prelude));
      if (optOut) continue;
      if (!inNoPreference(parents) || !inTimelineSupports(parents)) ungated.push(block.prelude);
      const pinSelector = splitList(block.prelude).some((s) =>
        /\[data-deck-pin\]$/.test(lastCompound(s)),
      );
      if (pinSelector && decls.some((d) => d.prop === "position" && d.value === "sticky")) {
        pinSticky = true;
      }
    }
    expect(ungated).toEqual([]);
    expect(pinSticky, "[data-deck-pin] { position: sticky }").toBe(true);
  });

  it("C3: reduced motion and calm turn off deck card and fan card animations", () => {
    const covered = { reduce: new Set<string>(), calm: new Set<string>() };
    for (const { block, parents } of rules(scrollTree)) {
      const decls = declarations(block.body);
      const off = decls.some(
        (d) => d.prop === "animation" && /^none\s*!important$/.test(d.value),
      );
      if (!off) continue;
      for (const sel of splitList(block.prelude)) {
        for (const hook of ["[data-deck-card]", "[data-fan-card]"]) {
          if (!sel.includes(hook)) continue;
          if (inReduce(parents)) covered.reduce.add(hook);
          if (/\[data-effects=["']?calm["']?\]/.test(sel)) covered.calm.add(hook);
        }
      }
    }
    expect([...covered.reduce].sort(), "under prefers-reduced-motion: reduce").toEqual([
      "[data-deck-card]",
      "[data-fan-card]",
    ]);
    expect([...covered.calm].sort(), 'under html[data-effects="calm"]').toEqual([
      "[data-deck-card]",
      "[data-fan-card]",
    ]);
  });

  it("C4: no rule on a card or card ancestor sets opacity, filter, mask, clip-path, mix-blend-mode or such will-change", () => {
    const bad: string[] = [];
    for (const [file, tree] of [
      ["globals.css", globalsTree],
      ["scroll.css", scrollTree],
    ] as const) {
      for (const { block } of rules(tree)) {
        const targets = splitList(block.prelude).filter((sel) => {
          const last = lastCompound(sel);
          // A pseudo-element is its own box, not the card or an ancestor of it.
          if (last.includes("::")) return false;
          return CARD_OR_ANCESTOR.some((re) => re.test(last));
        });
        if (targets.length === 0) continue;
        for (const d of declarations(block.body)) {
          const value = d.value.replace(/\s*!important$/, "").trim();
          const hit =
            (d.prop === "opacity" && value !== "1") ||
            d.prop === "filter" ||
            d.prop === "-webkit-filter" ||
            d.prop === "mask" ||
            d.prop === "mask-image" ||
            d.prop === "-webkit-mask" ||
            d.prop === "-webkit-mask-image" ||
            d.prop === "clip-path" ||
            d.prop === "mix-blend-mode" ||
            (d.prop === "will-change" && /opacity|filter/.test(value));
          if (hit) bad.push(`${file} ${targets.join(", ")} { ${d.prop}: ${d.value} }`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("C5: .deck-card frosts with backdrop-filter: blur(12px)", () => {
    let found = false;
    for (const { block } of rules(globalsTree)) {
      const onCard = splitList(block.prelude).some((s) => /^\.deck-card$/.test(lastCompound(s)));
      if (!onCard) continue;
      if (
        declarations(block.body).some(
          (d) => d.prop === "backdrop-filter" && /blur\(12px\)/.test(d.value),
        )
      ) {
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("C6: red and blue tint the shots with hue-rotate, applied to the fan image as a filter", () => {
    const tint = { red: false, blue: false };
    let applied = false;
    for (const { block } of rules(globalsTree)) {
      const decls = declarations(block.body);
      for (const sel of splitList(block.prelude)) {
        const setsTint = decls.some((d) => d.prop === "--shot-tint" && d.value.includes("hue-rotate("));
        if (setsTint && sel.includes(".sect--projects")) {
          if (/html\[data-pill=["']?red["']?\]/.test(sel)) tint.red = true;
          if (/html\[data-pill=["']?blue["']?\]/.test(sel)) tint.blue = true;
        }
        const onImg = /^img(?![\w-])/.test(lastCompound(sel)) && /\.fan-card|\[data-fan-card\]/.test(sel);
        if (onImg && decls.some((d) => d.prop === "filter" && d.value.startsWith("var(--shot-tint"))) {
          applied = true;
        }
      }
    }
    expect(tint, "--shot-tint: hue-rotate(...) per mode").toEqual({ red: true, blue: true });
    expect(applied, "filter: var(--shot-tint ...) on the fan img").toBe(true);
  });

  it("C7: no fan image is cropped with object-fit: cover", () => {
    const bad: string[] = [];
    for (const [file, tree] of [
      ["globals.css", globalsTree],
      ["scroll.css", scrollTree],
    ] as const) {
      for (const { block } of rules(tree)) {
        const fanSel = splitList(block.prelude).filter((s) => FAN.test(s));
        if (fanSel.length === 0) continue;
        for (const d of declarations(block.body)) {
          if (d.prop !== "object-fit") continue;
          if (!/^contain(\s*!important)?$/.test(d.value)) bad.push(`${file} ${fanSel.join(", ")} { object-fit: ${d.value} }`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
