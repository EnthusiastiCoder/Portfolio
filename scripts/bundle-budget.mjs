import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Raised from 215040 to fit Three.js (tree-shaken). USER-APPROVED 2026-11-23: "Real 3D, always".
export const FIRST_LOAD_BUDGET_BYTES = 389120; // 380 KiB gzip

export function extractScriptSrcs(html) {
  const out = [];
  const re = /<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1];
    if (src.startsWith("/_next/static/") && !out.includes(src)) out.push(src);
  }
  return out;
}

export function gzipBytes(buf) {
  return gzipSync(buf, { level: 9 }).length;
}

export async function measureFirstLoad({ html, readAsset }) {
  const files = [];
  let total = 0;
  for (const src of extractScriptSrcs(html)) {
    const gzip = gzipBytes(await readAsset(src));
    files.push({ src, gzip });
    total += gzip;
  }
  return { files, total };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.cwd();
  const html = readFileSync(path.join(root, ".next/server/app/index.html"), "utf8");
  const { files, total } = await measureFirstLoad({
    html,
    readAsset: (src) => readFileSync(path.join(root, ".next", src.replace("/_next/", ""))),
  });
  for (const f of files) console.log(String(f.gzip).padStart(8), f.src);
  console.log(String(total).padStart(8), "TOTAL (budget " + FIRST_LOAD_BUDGET_BYTES + ")");
  if (total > FIRST_LOAD_BUDGET_BYTES) {
    console.error("First-load JS over budget");
    process.exit(1);
  }
}
