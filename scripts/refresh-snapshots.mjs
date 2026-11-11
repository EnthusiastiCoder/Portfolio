#!/usr/bin/env node
// Manually refreshes src/data/snapshots/{github,leetcode}.json from the live APIs.
// Run with `pnpm snapshot:refresh`. Never run in tests or CI.
// Mirrors the transforms in src/lib/stats/{github,leetcode}.ts.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
