import { test, expect } from "@playwright/test";
import { siteConfig } from "../src/config/site";
import { projects } from "../src/data/projects";
import githubSnapshot from "../src/data/snapshots/github.json";
import leetcodeSnapshot from "../src/data/snapshots/leetcode.json";

// Same rule as src/lib/format.ts formatCompactNumber.
const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

test.describe("home page", () => {
  // Case 38
  test("returns 200 and has exactly one h1 containing the site name", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText(siteConfig.name);
  });
