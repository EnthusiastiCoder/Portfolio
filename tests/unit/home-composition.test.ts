import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// T22
describe("home composition", () => {
  const BANNED = ["FeaturedRepos", "GitHubStatsCard", "featuredRepos", "StatsSection"];

  it.each(["src/app/page.tsx", "src/components/Projects.tsx"])(
    "%s does not reference the old repo/stats blocks",
    (rel) => {
      const src = read(rel);
      for (const name of BANNED) expect(src.includes(name), `${rel} contains ${name}`).toBe(false);
    },
  );

  it.each([
    "src/components/FeaturedRepos.tsx",
    "src/components/GitHubStatsCard.tsx",
    "src/components/StatsSection.tsx",
    "src/content/projects/matrix-portfolio.mdx",
  ])("%s is deleted", (rel) => {
    expect(existsSync(path.join(ROOT, rel))).toBe(false);
  });

  it("page.tsx keeps the 6-hour revalidate", () => {
    expect(read("src/app/page.tsx")).toContain("export const revalidate = 21600;");
  });
});

// T23
describe("matrix-portfolio is gone from src/", () => {
  it("no file under src/ contains matrix-portfolio", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (readFileSync(full, "utf8").includes("matrix-portfolio")) {
          hits.push(path.relative(ROOT, full).split(path.sep).join("/"));
        }
      }
    };
    walk(path.join(ROOT, "src"));
    expect(hits).toEqual([]);
  });
});
