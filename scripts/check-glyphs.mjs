#!/usr/bin/env node
// Dependency-free scan for emoji and decorative glyphs.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BANNED_RE =
  /[\p{Extended_Pictographic}\p{Emoji_Presentation}←-⇿⌀-⏿─-╿■-◿☀-⛿✀-➿⟰-⟿⤀-⥿︀-️•]/gu;

export const ALLOWED_CHARS = new Set([0xa9, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0xb7]);

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "out", "coverage", "plans", "research", "playwright-report", "test-results"]);
const SRC_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".mdx", ".md", ".css", ".json"]);

const fmt = (n) => "U+" + n.toString(16).toUpperCase().padStart(4, "0");

export function findBannedGlyphs(text, file) {
  const out = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    let col = 0;
    for (const ch of line) {
      col += 1;
      const cp = ch.codePointAt(0);
      if (ALLOWED_CHARS.has(cp)) continue;
      BANNED_RE.lastIndex = 0;
      if (BANNED_RE.test(ch)) out.push({ file, line: i + 1, column: col, char: ch, codePoint: fmt(cp) });
    }
  });
  return out;
}

export function loadAllowlist(file) {
  if (!existsSync(file)) return { entries: [] };
  return JSON.parse(readFileSync(file, "utf8"));
}

function walk(dir, rootDir, acc) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.relative(rootDir, abs).split(path.sep).join("/");
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name) || rel === "tests/fixtures") continue;
      walk(abs, rootDir, acc);
    } else {
      const ext = path.extname(name);
      const inSrc = rel.startsWith("src/") || rel.startsWith("content/");
      if (ext === ".mdx" || (inSrc && SRC_EXT.has(ext))) acc.push({ abs, rel });
    }
  }
}

export function scanRepo(rootDir, opts = {}, counter) {
  const allow = opts.allowlist?.entries ?? [];
  const files = [];
  walk(rootDir, rootDir, files);
  if (counter) counter.n = files.length;
  const out = [];
  for (const { abs, rel } of files) {
    for (const v of findBannedGlyphs(readFileSync(abs, "utf8"), rel)) {
      if (allow.some((e) => e.file === v.file && e.char === v.codePoint)) continue;
      out.push(v);
    }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const target = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(here, "..");
  const allowlist = loadAllowlist(path.join(here, "glyph-allowlist.json"));
  const counter = { n: 0 };
  let found;
  if (process.argv[2]) {
    // Explicit target: scan every text file in it (used to check fixtures).
    found = [];
    const files = [];
    const collect = (d) => { for (const n of readdirSync(d)) { const a = path.join(d, n); statSync(a).isDirectory() ? collect(a) : files.push(a); } };
    statSync(target).isDirectory() ? collect(target) : files.push(target);
    counter.n = files.length;
    for (const f of files) found.push(...findBannedGlyphs(readFileSync(f, "utf8"), path.relative(process.cwd(), f).split(path.sep).join("/")));
  } else {
    found = scanRepo(target, { allowlist }, counter);
  }
  for (const v of found) console.error(`${v.file}:${v.line}:${v.column} ${v.codePoint}`);
  if (found.length) process.exit(1);
  console.log(`check-glyphs: OK (${counter.n} files)`);
}
