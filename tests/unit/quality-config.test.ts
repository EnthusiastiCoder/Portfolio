import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function read(rel: string): string {
  return readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

function readJson(rel: string): any {
  return JSON.parse(read(rel));
}

type Assertion = [string, { minScore?: number }];

describe("local Lighthouse setup", () => {
  // Case 57 (WS2)
  it("package.json has a lighthouse script running scripts/lighthouse.mjs and @lhci/cli as a dev dependency", () => {
    const pkg = readJson("package.json");
    expect(typeof pkg.scripts?.lighthouse).toBe("string");
    expect(pkg.scripts.lighthouse).toContain("scripts/lighthouse.mjs");
    expect(pkg.devDependencies?.["@lhci/cli"]).toBeDefined();
  });

  // Case 58 (WS2)
  it("lighthouserc.json asserts the thresholds, runs 3+ times on both URLs and never uploads publicly", () => {
    const rc = readJson("lighthouserc.json");
    const assertions: Record<string, Assertion> = rc.ci?.assert?.assertions ?? rc.assert?.assertions;
    expect(assertions).toBeDefined();
