import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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
    const assertions: Record<string, Assertion> =
      rc.ci?.assert?.assertions ?? rc.assert?.assertions;
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

  // Case 106 (WS2, rev 4)
  describe("desktop preset (secondary gate)", () => {
    it("lighthouserc.desktop.json exists", () => {
      expect(existsSync(path.resolve(process.cwd(), "lighthouserc.desktop.json"))).toBe(true);
    });

    it("uses the desktop preset on the same two URLs with 3 runs", () => {
      const desktop = readJson("lighthouserc.desktop.json");
      const mobile = readJson("lighthouserc.json");
      expect(desktop.ci?.collect?.settings?.preset).toBe("desktop");
      const mobileUrls: string[] = mobile.ci?.collect?.url ?? mobile.collect?.url;
      expect(desktop.ci.collect.url).toEqual(mobileUrls);
      expect(desktop.ci.collect.url).toHaveLength(2);
      expect(desktop.ci.collect.numberOfRuns).toBe(3);
    });

    it("asserts performance >= 0.95 and a11y/BP/SEO >= 0.95", () => {
      const desktop = readJson("lighthouserc.desktop.json");
      const assertions: Record<string, Assertion> = desktop.ci?.assert?.assertions;
      expect(assertions).toBeDefined();
      expect(assertions["categories:performance"]).toEqual(["error", { minScore: 0.95 }]);
      for (const cat of ["accessibility", "best-practices", "seo"]) {
        const a = assertions[`categories:${cat}`];
        expect(a, `categories:${cat}`).toBeDefined();
        expect(a[0]).toBe("error");
        expect(a[1].minScore).toBe(0.95);
      }
    });

    it("uploads to the filesystem", () => {
      const desktop = readJson("lighthouserc.desktop.json");
      expect(desktop.ci?.upload?.target).toBe("filesystem");
    });

    it("scripts/lighthouse.mjs references both config files", () => {
      const script = read("scripts/lighthouse.mjs");
      expect(script).toContain("lighthouserc.json");
      expect(script).toContain("lighthouserc.desktop.json");
    });
  });
});

// T9 (WS3): Lighthouse metric budgets.
describe("Lighthouse metric budgets", () => {
  type MetricAssertion = [string, { maxNumericValue?: number }];

  function metricAssertions(rel: string): Record<string, MetricAssertion> {
    const rc = readJson(rel);
    return rc.ci?.assert?.assertions ?? rc.assert?.assertions ?? {};
  }

  function expectMax(a: Record<string, MetricAssertion>, key: string, max: number): void {
    const entry = a[key];
    expect(entry, key).toBeDefined();
    expect(entry[0], `${key} level`).toBe("error");
    expect(typeof entry[1]?.maxNumericValue, `${key} maxNumericValue`).toBe("number");
    expect(entry[1].maxNumericValue!, key).toBeLessThanOrEqual(max);
  }

  it.each([
    ["lighthouserc.json", 2500],
    ["lighthouserc.desktop.json", 1500],
  ] as const)(
    "%s asserts LCP <= %d ms, CLS <= 0.1, TBT <= 200 ms and script size <= 215040 bytes",
    (file, lcp) => {
      const a = metricAssertions(file);
      expectMax(a, "largest-contentful-paint", lcp);
      expectMax(a, "cumulative-layout-shift", 0.1);
      expectMax(a, "total-blocking-time", 200);
      expectMax(a, "resource-summary:script:size", 215040);
    },
  );
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

    // Isolate the e2e job block: from "  e2e:" to the next top-level job key or EOF.
    const start = jobsIdx + (e2eMatch!.index ?? 0);
    const rest = ci.slice(start + e2eMatch![0].length);
    const next = rest.search(/^ {2}[A-Za-z0-9_-]+:\s*$/m);
    const block = next === -1 ? rest : rest.slice(0, next);

    expect(block).toContain("playwright install");
    expect(block).toContain("pnpm e2e");
    expect(block).toMatch(/STATS_SOURCE:\s*["']?snapshot["']?/);
  });
});
