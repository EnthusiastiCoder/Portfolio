// Validates the info server's content. Run: bun info-server/check.ts  (exit 1 on any problem)
//   glossary   every [[ref]] resolves, no self-reference, ≤ 200 chars and ≤ 2 sentences per definition
//   manifest   ids valid and unique, files exist, projects known
//   kit pages  every data-kit-open has its modal, every modal starts with a visual,
//              no text block > 240 chars, bird's-eye answer ≤ 5 lines
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Artifact, CONTENT, fileOf } from "./server";
