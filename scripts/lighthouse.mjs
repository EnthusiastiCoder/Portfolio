#!/usr/bin/env node
// Local-only Lighthouse gate. Not run in CI: shared runners are too noisy for
// stable performance scores and need a real Chrome.
//
// 1. Builds the site with STATS_SOURCE=snapshot (deterministic, no network).
// 2. Runs `lhci autorun` with the mobile config (lighthouserc.json), then the
//    desktop config (lighthouserc.desktop.json).
// 3. Exits non-zero if the build or either run fails.
//
// Chrome: honours CHROME_PATH (e.g. Edge on Windows), otherwise uses
// Playwright's bundled Chromium.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const isWindows = process.platform === "win32";

function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = ["playwright-core", "@playwright/test"];
  for (const name of candidates) {
    try {
      const mod = require(name);
      const exe = mod.chromium?.executablePath?.();
      if (exe && existsSync(exe)) return exe;
    } catch {
      // try the next candidate
    }
  }
  try {
    const testPkg = require.resolve("@playwright/test/package.json");
    const core = createRequire(testPkg)("playwright-core");
    const exe = core.chromium.executablePath();
    if (exe && existsSync(exe)) return exe;
  } catch {
    // fall through
  }
  return undefined;
}

function run(label, command, args, env) {
  console.log(`\n[lighthouse] ${label}: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: isWindows,
  });
  if (result.error) {
    console.error(`[lighthouse] ${label} failed to start:`, result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

const chromePath = resolveChrome();
if (!chromePath) {
  console.error(
    "[lighthouse] No Chrome found. Set CHROME_PATH or run `pnpm exec playwright install chromium`.",
  );
  process.exit(1);
}
console.log(`[lighthouse] Using Chrome at ${chromePath}`);

const env = { ...process.env, STATS_SOURCE: "snapshot", CHROME_PATH: chromePath };

if (run("build", "pnpm", ["build"], env) !== 0) {
  console.error("[lighthouse] Build failed.");
  process.exit(1);
}
