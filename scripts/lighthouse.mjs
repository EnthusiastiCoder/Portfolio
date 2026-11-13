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
