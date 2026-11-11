#!/usr/bin/env node
// Manually refreshes src/data/snapshots/{github,leetcode}.json from the live APIs.
// Run with `pnpm snapshot:refresh`. Never run in tests or CI.
// Mirrors the transforms in src/lib/stats/{github,leetcode}.ts.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotDir = path.join(root, "src/data/snapshots");

async function readHandles() {
  const site = await readFile(path.join(root, "src/config/site.ts"), "utf8");
  const github = /github:\s*"([^"]+)"/.exec(site)?.[1];
  const leetcode = /leetcode:\s*"([^"]+)"/.exec(site)?.[1];
  if (!github || !leetcode) throw new Error("Could not read handles from src/config/site.ts");
  return { github, leetcode };
}

const byNameAsc = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
