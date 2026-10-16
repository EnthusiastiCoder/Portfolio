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

    expect(assertions["categories:performance"]).toEqual(["error", { minScore: 0.9 }]);
    for (const cat of ["accessibility", "best-practices", "seo"]) {
      const a = assertions[`categories:${cat}`];
      expect(a, `categories:${cat}`).toBeDefined();
      expect(a[0]).toBe("error");
      expect(a[1].minScore).toBe(0.95);
    }

    const collect = rc.ci?.collect ?? rc.collect;
    expect(collect.numberOfRuns).toBeGreaterThanOrEqual(3);
    expect(collect.url).toContain("http://localhost:3000/");
    expect(
      (collect.url as string[]).some((u) => u.startsWith("http://localhost:3000/projects/")),
    ).toBe(true);

    const upload = rc.ci?.upload ?? rc.upload ?? {};
    expect(upload.target).not.toBe("temporary-public-storage");
  });
});

describe("CI workflow", () => {
  // Case 59 (WS1)
  it("ci.yml has no Lighthouse and runs pnpm test and pnpm build", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).not.toMatch(/lhci|lighthouse/i);
    expect(ci).not.toMatch(/@lhci\/cli/i);
    expect(ci).toContain("pnpm test");
    expect(ci).toContain("pnpm build");
  });

  // Case 60 (WS2)
  it("ci.yml has an e2e job running Playwright with STATS_SOURCE: snapshot", () => {
    const ci = read(".github/workflows/ci.yml");
    const jobsIdx = ci.search(/^jobs:\s*$/m);
    expect(jobsIdx).toBeGreaterThanOrEqual(0);
    const e2eMatch = ci.slice(jobsIdx).match(/^ {2}e2e:\s*$/m);
    expect(e2eMatch, "jobs.e2e").not.toBeNull();
