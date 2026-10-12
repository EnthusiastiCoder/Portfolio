// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createElement, type ComponentType } from "react";
import { cleanup, render } from "@testing-library/react";

// WS1 glyph-lint-and-visual: T1-T9.
// Glyphs are written as escapes so this file passes the repo scan itself.

const root = process.cwd();
const SCRIPT = path.resolve(root, "scripts/check-glyphs.mjs");
const ALLOWLIST = path.resolve(root, "scripts/glyph-allowlist.json");
const FIXTURES = path.resolve(root, "tests/fixtures/glyphs");

type Violation = {
  file: string;
  line: number;
  column: number;
  char: string;
  codePoint: string;
};

type GlyphModule = {
  BANNED_RE: RegExp;
  ALLOWED_CHARS: Set<string | number>;
  findBannedGlyphs: (text: string, file: string) => Violation[];
  loadAllowlist: (file: string) => unknown;
  scanRepo: (rootDir: string, opts?: { allowlist?: unknown }) => Violation[] | Promise<Violation[]>;
};

/** Loaded lazily so each case fails on its own while the scanner is missing. */
async function glyphs(): Promise<GlyphModule> {
  expect(existsSync(SCRIPT), "scripts/check-glyphs.mjs exists").toBe(true);
  // import.meta.glob returns {} while the file is missing, so the file still loads and
  // each case fails on its own; once the file exists it is a normal (aliased) import.
  const mods = import.meta.glob("/scripts/check-glyphs.mjs");
  return (await mods["/scripts/check-glyphs.mjs"]()) as unknown as GlyphModule;
}

const cp = (n: number) => `U+${n.toString(16).toUpperCase().padStart(4, "0")}`;

const byFileChar = (a: Violation, b: Violation) =>
  `${a.file}|${a.codePoint}`.localeCompare(`${b.file}|${b.codePoint}`);

const tempDirs: string[] = [];
function tempRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "glyph-lint-"));
  tempDirs.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text, "utf8");
  }
  return dir;
}

afterEach(() => {
  cleanup();
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("check-glyphs exports", () => {
  it("exports a global, unicode BANNED_RE and an ALLOWED_CHARS set containing U+00A9", async () => {
    const g = await glyphs();
    expect(g.BANNED_RE).toBeInstanceOf(RegExp);
    expect(g.BANNED_RE.flags).toContain("u");
    expect(g.BANNED_RE.flags).toContain("g");
    expect(g.ALLOWED_CHARS.has(0xa9) || g.ALLOWED_CHARS.has("©")).toBe(true);
  });
});

describe("findBannedGlyphs on the fixtures", () => {
  // T1
  it("flags the rocket emoji in tests/fixtures/glyphs/emoji.tsx at line 3, column 23", async () => {
    const g = await glyphs();
    const file = "tests/fixtures/glyphs/emoji.tsx";
    const text = readFileSync(path.join(FIXTURES, "emoji.tsx"), "utf8");
    expect(g.findBannedGlyphs(text, file)).toEqual([
      { file, line: 3, column: 23, char: "\u{1F680}", codePoint: "U+1F680" },
    ]);
  });

  // T2
  it("flags the right arrow in tests/fixtures/glyphs/arrow.mdx at line 3, column 11", async () => {
    const g = await glyphs();
    const file = "tests/fixtures/glyphs/arrow.mdx";
    const text = readFileSync(path.join(FIXTURES, "arrow.mdx"), "utf8");
    expect(g.findBannedGlyphs(text, file)).toEqual([
      { file, line: 3, column: 11, char: "→", codePoint: "U+2192" },
    ]);
  });
});

describe("findBannedGlyphs character classes", () => {
  // T3
  const BANNED = [0x2022, 0x25b8, 0x2605, 0x2713, 0x2500, 0x2197, 0xfe0f, 0x2b50];
  it.each(BANNED.map((n) => [cp(n), n] as const))("flags %s", async (label, n) => {
    const g = await glyphs();
    const ch = String.fromCodePoint(n);
    expect(g.findBannedGlyphs(`ab${ch}cd`, "src/x.ts")).toEqual([
      { file: "src/x.ts", line: 1, column: 3, char: ch, codePoint: label },
    ]);
  });

  // T4
  const ALLOWED = [
    0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x00a9, 0x00b7, 0xff71, 0xff8a,
    0x30a2, 0x30fb, 0x00a6,
  ];
  it.each(ALLOWED.map((n) => [cp(n), n] as const))("does not flag %s", async (_label, n) => {
    const g = await glyphs();
    const ch = String.fromCodePoint(n);
    expect(g.findBannedGlyphs(`ab${ch}cd`, "src/x.ts")).toEqual([]);
  });

  it("does not flag a line of allowed punctuation and half-width katakana together", async () => {
    const g = await glyphs();
    const text = ALLOWED.map((n) => String.fromCodePoint(n)).join(" ");
    expect(g.findBannedGlyphs(`plain ascii\n${text}\n`, "src/y.mdx")).toEqual([]);
  });
});

describe("allowlist", () => {
  // T5
  it("suppresses exactly the listed file + char and nothing else", async () => {
    const g = await glyphs();
    const dir = tempRepo({
      "src/a.tsx": "export const a = `go → and • list`;\n",
      "src/b.tsx": "export const b = `go →`;\n",
      "allow.json": JSON.stringify({
        entries: [{ file: "src/a.tsx", char: "U+2192", reason: "test" }],
      }),
    });
    const allowlist = g.loadAllowlist(path.join(dir, "allow.json"));
    const found = [...(await g.scanRepo(dir, { allowlist }))].sort(byFileChar);
    expect(found.map((v) => [v.file, v.codePoint])).toEqual([
      ["src/a.tsx", "U+2022"],
      ["src/b.tsx", "U+2192"],
    ]);
  });

  // T8
  it("scripts/glyph-allowlist.json exists, parses and has an entries array", () => {
    expect(existsSync(ALLOWLIST), "scripts/glyph-allowlist.json").toBe(true);
    const json = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
    expect(Array.isArray(json.entries)).toBe(true);
    for (const e of json.entries) {
      expect(typeof e.file).toBe("string");
      expect(e.char).toMatch(/^U\+[0-9A-F]{4,6}$/);
      expect(typeof e.reason).toBe("string");
    }
  });
});

describe("scanRepo", () => {
  it("scans src/** and *.mdx anywhere, but skips tests/fixtures and node_modules", async () => {
    const g = await glyphs();
    const dir = tempRepo({
      "src/c.css": ".x::before { content: \"▸\"; }\n",
      "docs/page.mdx": "Hello ★\n",
      "tests/fixtures/glyphs/skip.mdx": "\u{1F680}\n",
      "node_modules/pkg/readme.mdx": "\u{1F680}\n",
    });
    const found = [...(await g.scanRepo(dir, { allowlist: { entries: [] } }))].sort(byFileChar);
    expect(found.map((v) => [v.file, v.codePoint])).toEqual([
      ["docs/page.mdx", "U+2605"],
      ["src/c.css", "U+25B8"],
    ]);
  });

  // T6
  it("returns [] for the real repo with the real allowlist", async () => {
    const g = await glyphs();
    const allowlist = g.loadAllowlist(ALLOWLIST);
    const found = await g.scanRepo(root, { allowlist });
    expect(found).toEqual([]);
  });

  // T6 (CLI)
  it("CLI exits 0 on the repo and prints check-glyphs: OK", async () => {
    await glyphs();
    const out = execFileSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
    expect(out).toMatch(/check-glyphs: OK \(\d+ files\)/);
  });

  it("CLI exits 1 when pointed at tests/fixtures/glyphs and prints file:line:col U+2192", async () => {
    await glyphs();
    const res = spawnSync(process.execPath, [SCRIPT, FIXTURES], { cwd: root, encoding: "utf8" });
    expect(res.status).toBe(1);
    expect(`${res.stdout}${res.stderr}`).toMatch(/arrow\.mdx:3:11 U\+2192/);
  });
});

describe("lint wiring", () => {
  // T7
  it("package.json scripts.lint runs node scripts/check-glyphs.mjs", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(root, "package.json"), "utf8"));
    expect(pkg.scripts.lint).toContain("node scripts/check-glyphs.mjs");
  });
});

describe("SVG icons", () => {
  // T9
  it.each(["ArrowRightIcon", "ArrowDownIcon", "ExternalIcon"])(
    "%s renders an aria-hidden, non-focusable currentColor svg",
    async (name) => {
      expect(
        existsSync(path.resolve(process.cwd(), "src/components/icons.tsx")),
        "src/components/icons.tsx exists",
      ).toBe(true);
      const mods = import.meta.glob("/src/components/icons.tsx");
      const mod = (await mods["/src/components/icons.tsx"]()) as Record<string, unknown>;
      const Icon = mod[name] as ComponentType;
      expect(typeof Icon, `${name} export`).toBe("function");
      const { container } = render(createElement(Icon));
      const svg = container.querySelector('svg[aria-hidden="true"]');
      expect(svg, `${name} svg[aria-hidden="true"]`).not.toBeNull();
      expect(svg!.getAttribute("focusable")).toBe("false");
      expect(container.innerHTML).toContain("currentColor");
    },
  );
});
