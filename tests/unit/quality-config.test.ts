import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function read(rel: string): string {
  return readFileSync(path.resolve(process.cwd(), rel), "utf8");
}
